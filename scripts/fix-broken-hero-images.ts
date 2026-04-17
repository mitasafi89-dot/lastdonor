/**
 * Fix broken hero_image_urls in the campaigns table.
 *
 * For each campaign:
 *   1. HEAD-check the current URL (timeout 8s)
 *   2. If broken (non-2xx or local SVG fallback), search Unsplash for a
 *      replacement image using the campaign's category + title keywords
 *   3. If Unsplash fails, fall back to Pexels
 *   4. Update the DB row with the new URL + photo_credit attribution
 *
 * Usage: npx tsx scripts/fix-broken-hero-images.ts [--dry-run]
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const dryRun = process.argv.includes('--dry-run');

// ─── Category search queries (reused from image-generator) ────────────────

const CATEGORY_QUERIES: Record<string, string> = {
  medical: 'hospital patient recovery hope',
  disaster: 'community rebuilding after disaster',
  military: 'military family service honor',
  veterans: 'veteran community support',
  memorial: 'memorial candles flowers tribute',
  'first-responders': 'firefighter emergency service',
  community: 'neighbors helping community',
  'essential-needs': 'food bank shelter humanitarian',
  emergency: 'emergency relief crisis helping',
  charity: 'charity donation generosity',
  education: 'student education learning',
  animal: 'rescue dog shelter compassion',
  environment: 'nature conservation earth',
  business: 'small business community startup',
  competition: 'athletic youth sports competition',
  creative: 'art creative expression',
  event: 'community gathering celebration',
  faith: 'church community prayer',
  family: 'family together home love',
  sports: 'youth sports team athletics',
  travel: 'journey travel hope adventure',
  volunteer: 'volunteer helping service',
  wishes: 'wishes dream hope stars',
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface UnsplashPhoto {
  urls: { raw: string };
  user: { name: string; links: { html: string } };
}

interface PexelsPhoto {
  photographer: string;
  photographer_url: string;
  src: { original: string };
}

// ─── API Helpers ───────────────────────────────────────────────────────────

async function findUnsplashImage(query: string): Promise<{ url: string; credit: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    query,
    orientation: 'landscape',
    per_page: '1',
    content_filter: 'high',
  });

  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { results: UnsplashPhoto[] };
  const photo = data.results[0];
  if (!photo) return null;

  return {
    url: `${photo.urls.raw}&w=1200&h=630&fit=crop&auto=format&q=80`,
    credit: `Photo by ${photo.user.name} on Unsplash`,
  };
}

async function findPexelsImage(query: string): Promise<{ url: string; credit: string } | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({ query, orientation: 'landscape', per_page: '1' });
  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { photos: PexelsPhoto[] };
  const photo = data.photos[0];
  if (!photo) return null;

  return {
    url: `${photo.src.original}?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop`,
    credit: `Photo by ${photo.photographer} on Pexels`,
  };
}

// ─── URL Checker ───────────────────────────────────────────────────────────

async function isUrlBroken(url: string): Promise<boolean> {
  // Local paths (like /images/categories/...) are definitely placeholders
  if (!url.startsWith('http')) return true;

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8_000),
      redirect: 'follow',
    });
    return !res.ok;
  } catch {
    return true;
  }
}

// ─── Title → Search Query ──────────────────────────────────────────────────

function buildSearchQuery(title: string, category: string): string {
  // Extract meaningful keywords from the title (remove common filler words)
  const stopWords = new Set([
    'the', 'a', 'an', 'of', 'and', 'in', 'for', 'to', 'with', 'after',
    'his', 'her', 'their', 'its', 'at', 'by', 'from', 'on', 'is', 'are',
    'was', 'help', 'faces', 'family', 'community',
  ]);

  const titleKeywords = title
    .replace(/[^a-zA-Z\s]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 3)
    .join(' ');

  const baseCategoryQuery = CATEGORY_QUERIES[category] ?? CATEGORY_QUERIES.community!;
  const categoryWords = baseCategoryQuery.split(' ').slice(0, 2).join(' ');

  return `${titleKeywords} ${categoryWords}`.trim();
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Checking all campaign hero images${dryRun ? ' (DRY RUN)' : ''}...\n`);

  const campaigns = await client`
    SELECT id, slug, title, hero_image_url, category, photo_credit
    FROM campaigns
    ORDER BY created_at DESC
  `;

  let checked = 0;
  let broken = 0;
  let fixed = 0;

  for (const c of campaigns) {
    checked++;
    const isBroken = await isUrlBroken(c.hero_image_url);

    if (!isBroken) continue;

    broken++;
    console.log(`[BROKEN] ${c.slug}`);
    console.log(`  Current: ${c.hero_image_url.substring(0, 80)}`);

    const query = buildSearchQuery(c.title, c.category);
    console.log(`  Search:  "${query}"`);

    // Try Unsplash, then Pexels
    let replacement = await findUnsplashImage(query);
    if (!replacement) {
      replacement = await findPexelsImage(query);
    }

    if (!replacement) {
      console.log(`  SKIP:    No replacement found\n`);
      continue;
    }

    console.log(`  Replace: ${replacement.url.substring(0, 80)}...`);
    console.log(`  Credit:  ${replacement.credit}`);

    if (!dryRun) {
      await client`
        UPDATE campaigns
        SET hero_image_url = ${replacement.url},
            photo_credit = ${replacement.credit},
            updated_at = now()
        WHERE id = ${c.id}
      `;
      console.log(`  UPDATED\n`);
    } else {
      console.log(`  (dry run, not updated)\n`);
    }

    fixed++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. Checked: ${checked}, Broken: ${broken}, Fixed: ${fixed}`);
  await client.end();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
