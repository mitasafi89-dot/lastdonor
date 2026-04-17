/**
 * Generate the static fallback image pool for campaign hero images.
 *
 * Queries Unsplash (primary) and Pexels (fallback) for 5 landscape photos
 * per campaign category. Writes a TypeScript module to:
 *   src/lib/campaign-fallback-pool.ts
 *
 * Usage: npx tsx scripts/generate-fallback-pool.ts
 *
 * Rate limits:
 *   Unsplash: 50 req/hr (demo) → 23 categories = 23 requests
 *   Pexels:  200 req/hr        → only used if Unsplash < 3 results
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ─── Category Search Queries ───────────────────────────────────────────────
// Tuned for emotional resonance on a donation platform:
// - Empathy over pity (people donate to uplift, not to witness suffering)
// - Hope and rebuilding (positive framing drives action)
// - Authentic feel (not corporate stock)

const CATEGORY_QUERIES: Record<string, string> = {
  medical: 'hospital patient recovery hope compassion',
  disaster: 'community rebuilding after disaster hope',
  military: 'military family service honor tribute',
  veterans: 'veteran community support new beginning',
  memorial: 'memorial candles flowers tribute remembrance',
  'first-responders': 'firefighter hero emergency service courage',
  community: 'neighbors helping community volunteering together',
  'essential-needs': 'food bank shelter humanitarian aid warmth',
  emergency: 'emergency relief crisis helping hands',
  charity: 'charity volunteers donation giving generosity',
  education: 'student education scholarship learning growth',
  animal: 'rescue dog cat shelter adoption compassion',
  environment: 'nature conservation earth green sustainability',
  business: 'small business community support startup',
  competition: 'athletic determination youth sports competition',
  creative: 'art creative expression inspiration culture',
  event: 'community gathering celebration fundraiser',
  faith: 'church community prayer spiritual devotion',
  family: 'family together home children love bond',
  sports: 'youth sports team athletics support',
  travel: 'journey travel hope adventure road',
  volunteer: 'volunteer service community helping hands',
  wishes: 'wishes dream hope stars celebration',
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface UnsplashPhoto {
  id: string;
  urls: { raw: string };
  user: { name: string; links: { html: string } };
  alt_description: string | null;
}

interface PexelsPhoto {
  id: number;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: { original: string };
}

interface PoolEntry {
  url: string;
  attribution: string;
}

// ─── API Functions ─────────────────────────────────────────────────────────

async function searchUnsplash(query: string, perPage = 5): Promise<PoolEntry[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.warn('  UNSPLASH_ACCESS_KEY not set, skipping Unsplash');
    return [];
  }

  const params = new URLSearchParams({
    query,
    orientation: 'landscape',
    per_page: String(perPage),
    content_filter: 'high',
  });

  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: {
      Authorization: `Client-ID ${key}`,
      'Accept-Version': 'v1',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`  Unsplash ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return [];
  }

  const data = (await res.json()) as { results: UnsplashPhoto[] };
  return data.results.map((p) => ({
    url: `${p.urls.raw}&w=800&h=500&fit=crop&auto=format&q=80`,
    attribution: `Photo by ${p.user.name} on Unsplash`,
  }));
}

async function searchPexels(query: string, perPage = 5): Promise<PoolEntry[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    console.warn('  PEXELS_API_KEY not set, skipping Pexels');
    return [];
  }

  const params = new URLSearchParams({
    query,
    orientation: 'landscape',
    per_page: String(perPage),
  });

  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`  Pexels ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return [];
  }

  const data = (await res.json()) as { photos: PexelsPhoto[] };
  return data.photos.map((p) => ({
    url: `${p.src.original}?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop`,
    attribution: `Photo by ${p.photographer} on Pexels`,
  }));
}

// ─── Pool Generator ────────────────────────────────────────────────────────

async function generatePool(): Promise<Record<string, PoolEntry[]>> {
  const pool: Record<string, PoolEntry[]> = {};
  const categories = Object.keys(CATEGORY_QUERIES);

  console.log(`Generating fallback pool for ${categories.length} categories...\n`);

  for (const category of categories) {
    const query = CATEGORY_QUERIES[category]!;
    console.log(`[${category}] query: "${query}"`);

    let entries: PoolEntry[] = [];

    try {
      entries = await searchUnsplash(query, 5);
    } catch (err) {
      console.error(`  Unsplash error: ${err instanceof Error ? err.message : err}`);
    }

    // Supplement with Pexels if Unsplash returned fewer than 3
    if (entries.length < 3) {
      console.log(`  Unsplash returned ${entries.length}, supplementing with Pexels...`);
      try {
        const pexelsEntries = await searchPexels(query, 5 - entries.length);
        entries = [...entries, ...pexelsEntries];
      } catch (err) {
        console.error(`  Pexels error: ${err instanceof Error ? err.message : err}`);
      }
    }

    pool[category] = entries;
    console.log(`  -> ${entries.length} images\n`);

    // Respectful delay between API calls
    await new Promise((r) => setTimeout(r, 250));
  }

  return pool;
}

// ─── File Writer ───────────────────────────────────────────────────────────

function writePoolFile(pool: Record<string, PoolEntry[]>): void {
  const totalImages = Object.values(pool).reduce((sum, arr) => sum + arr.length, 0);
  const emptyCats = Object.entries(pool)
    .filter(([, v]) => v.length === 0)
    .map(([k]) => k);

  if (emptyCats.length > 0) {
    console.warn(`WARNING: No images for categories: ${emptyCats.join(', ')}`);
  }

  // Build the data as a JSON-safe structure, then embed it
  const poolJson = JSON.stringify(pool, null, 2);

  const output = `/**
 * Curated fallback image pool for campaign hero images.
 *
 * When an external hero image fails to load (403/404/timeout),
 * CampaignHeroImage picks a contextually appropriate stock photo
 * from this pool based on the campaign category.
 *
 * Auto-generated by: scripts/generate-fallback-pool.ts
 * Sources: Unsplash (primary), Pexels (fallback)
 * Regenerate: npx tsx scripts/generate-fallback-pool.ts
 *
 * Total: ${totalImages} images across ${Object.keys(pool).length} categories
 */

export interface FallbackImage {
  url: string;
  attribution: string;
}

const POOL: Record<string, FallbackImage[]> = ${poolJson};

/**
 * Deterministic hash so the same campaign always picks the same fallback.
 */
function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Get a fallback image for a campaign whose hero image failed to load.
 *
 * @param category Campaign category (e.g. "medical", "memorial").
 * @param seed     Deterministic seed (campaign title) so the same campaign
 *                 always gets the same fallback image.
 * @returns A FallbackImage with url + attribution, or null if pool is empty.
 */
export function getCampaignFallback(
  category: string,
  seed: string,
): FallbackImage | null {
  const pool = POOL[category] ?? POOL['community'];
  if (!pool || pool.length === 0) return null;
  return pool[stableHash(seed) % pool.length]!;
}
`;

  const filePath = resolve(__dirname, '..', 'src', 'lib', 'campaign-fallback-pool.ts');
  writeFileSync(filePath, output.trimStart());
  console.log(`Wrote: src/lib/campaign-fallback-pool.ts (${totalImages} images)`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const pool = await generatePool();
  writePoolFile(pool);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
