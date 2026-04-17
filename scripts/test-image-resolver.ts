/**
 * Diagnostic script: Test the 5-tier image resolver against 5 real-world
 * campaign scenarios to verify image sourcing from news, OG/meta,
 * Unsplash, Pexels, and category fallback.
 *
 * Usage: npx tsx scripts/test-image-resolver.ts
 *
 * This script does NOT touch the database or require AI keys.
 * It only exercises the image resolver's network-facing tiers.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ── Inline the resolver logic (can't use path aliases in scripts) ─────────

const MIN_IMAGE_BYTES = 5_000;
const FETCH_TIMEOUT_MS = 6_000;

type ImageSource = 'news' | 'og_meta' | 'unsplash' | 'pexels' | 'fallback';

type ImageResolution = {
  url: string;
  credit: string | null;
  source: ImageSource;
};

type ImageResolverContext = {
  newsImageUrl?: string;
  articleUrl?: string;
  category: string;
  subjectName?: string;
  event?: string;
  location?: string;
};

const CATEGORY_FALLBACK_MAP: Record<string, string> = {
  emergency: 'disaster',
  charity: 'community',
  education: 'community',
  animal: 'community',
  environment: 'community',
  business: 'community',
  competition: 'community',
  creative: 'community',
  event: 'community',
  faith: 'community',
  family: 'essential-needs',
  sports: 'community',
  travel: 'community',
  volunteer: 'community',
  wishes: 'memorial',
};

function getCategoryFallbackImage(category: string): string {
  const mapped = CATEGORY_FALLBACK_MAP[category] ?? category;
  return `/images/categories/${mapped}-default.svg`;
}

async function validateImageWithSize(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('/')) return url;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LastDonor/1.0)', Accept: 'image/*' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) return undefined;
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) < MIN_IMAGE_BYTES) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function extractImageCandidates(html: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined) => {
    if (!url || seen.has(url)) return;
    if (!url.startsWith('https://')) return;
    if (url.includes('favicon') || url.includes('logo') || url.endsWith('.ico')) return;
    seen.add(url);
    candidates.push(url);
  };
  const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"[^>]*>/i)
    ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"[^>]*>/i);
  add(ogMatch?.[1]);
  const twitterMatch = html.match(/<meta[^>]*(?:name|property)="twitter:image(?::src)?"[^>]*content="([^"]+)"[^>]*>/i)
    ?? html.match(/<meta[^>]*content="([^"]+)"[^>]*(?:name|property)="twitter:image(?::src)?"[^>]*>/i);
  add(twitterMatch?.[1]);
  const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch;
  while ((ldMatch = ldRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(ldMatch[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (['NewsArticle', 'Article', 'ReportageNewsArticle'].includes(item['@type'])) {
          const img = item.image;
          if (typeof img === 'string') add(img);
          else if (Array.isArray(img)) for (const i of img) add(typeof i === 'string' ? i : i?.url);
          else if (img?.url) add(img.url);
          if (typeof item.thumbnailUrl === 'string') add(item.thumbnailUrl);
        }
      }
    } catch { /* skip */ }
  }
  return candidates;
}

async function extractAndValidateOgImage(articleUrl: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const html = await res.text();
    const candidates = extractImageCandidates(html);
    for (const candidate of candidates) {
      const validated = await validateImageWithSize(candidate);
      if (validated) return validated;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

const CATEGORY_QUERY_FRAMING: Record<string, string> = {
  medical: 'hospital recovery hope family support',
  disaster: 'community rebuilding hope neighbors helping',
  military: 'military family tribute honor service',
  veterans: 'veteran community support new beginning',
  memorial: 'memorial tribute remembrance candles flowers',
  'first-responders': 'first responder hero courage community',
  community: 'neighbors helping community together',
  'essential-needs': 'food shelter humanitarian aid warmth',
  emergency: 'emergency relief helping hands community',
  charity: 'volunteers donation giving generosity',
  education: 'student scholarship learning growth',
  animal: 'animal rescue shelter adoption compassion',
  environment: 'nature conservation sustainability',
  business: 'small business community support',
  competition: 'athletic determination youth sports',
  creative: 'art creative expression inspiration',
  event: 'community gathering celebration fundraiser',
  faith: 'community prayer spiritual devotion',
  family: 'family together home children love',
  sports: 'youth sports team athletics support',
  travel: 'journey hope adventure road',
  volunteer: 'volunteer service community helping',
  wishes: 'dream wish hope celebration',
};

function extractEventKeywords(event: string | undefined): string {
  if (!event) return '';
  const stopWords = new Set([
    'a','an','the','in','on','at','to','for','of','with','and','or','but','is','was',
    'were','are','been','being','has','had','have','do','does','did','will','would',
    'could','should','may','might','shall','can','that','this','these','those','from',
    'by','as','into','through','during','before','after','above','below','between',
    'under','over','up','down','out','off','then','once','here','there','when','where',
    'why','how','all','each','every','both','few','more','most','other','some','such',
    'no','not','only','own','same','so','than','too','very','just','because','while',
    'who','whom','which','what','about','his','her','its','their','our','your','my',
    'he','she','it','they','we','you','i','me','him','us','them',
  ]);
  return event.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w)).slice(0, 3).join(' ');
}

function buildStockPhotoQuery(ctx: ImageResolverContext): string {
  const parts: string[] = [];
  const eventKeywords = extractEventKeywords(ctx.event);
  if (eventKeywords) parts.push(eventKeywords);
  if (ctx.location && ctx.location !== 'Unknown') {
    const shortLocation = ctx.location.split(',')[0].trim();
    if (shortLocation.length > 2 && shortLocation.length < 30) parts.push(shortLocation);
  }
  const framing = CATEGORY_QUERY_FRAMING[ctx.category] ?? 'community support hope';
  parts.push(framing);
  return parts.join(' ').slice(0, 100).trim();
}

async function searchUnsplashContextual(ctx: ImageResolverContext): Promise<{ url: string; credit: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const query = buildStockPhotoQuery(ctx);
  try {
    const params = new URLSearchParams({ query, orientation: 'landscape', per_page: '1', content_filter: 'high' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { results: Array<{ urls: { raw: string }; user: { name: string } }> };
    const photo = data.results[0];
    if (!photo) return null;
    return {
      url: `${photo.urls.raw}&w=800&h=500&fit=crop&auto=format&q=80`,
      credit: `Photo by ${photo.user.name} on Unsplash`,
    };
  } catch { return null; }
}

async function searchPexelsContextual(ctx: ImageResolverContext): Promise<{ url: string; credit: string } | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const query = buildStockPhotoQuery(ctx);
  try {
    const params = new URLSearchParams({ query, orientation: 'landscape', per_page: '1' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: key },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { photos: Array<{ src: { original: string }; photographer: string }> };
    const photo = data.photos[0];
    if (!photo) return null;
    return {
      url: `${photo.src.original}?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop`,
      credit: `Photo by ${photo.photographer} on Pexels`,
    };
  } catch { return null; }
}

async function resolveHeroImageEnhanced(ctx: ImageResolverContext): Promise<ImageResolution> {
  const newsUrl = await validateImageWithSize(ctx.newsImageUrl);
  if (newsUrl) return { url: newsUrl, credit: null, source: 'news' };

  if (ctx.articleUrl) {
    const ogUrl = await extractAndValidateOgImage(ctx.articleUrl);
    if (ogUrl) return { url: ogUrl, credit: null, source: 'og_meta' };
  }

  const unsplashResult = await searchUnsplashContextual(ctx);
  if (unsplashResult) return { url: unsplashResult.url, credit: unsplashResult.credit, source: 'unsplash' };

  const pexelsResult = await searchPexelsContextual(ctx);
  if (pexelsResult) return { url: pexelsResult.url, credit: pexelsResult.credit, source: 'pexels' };

  return { url: getCategoryFallbackImage(ctx.category), credit: null, source: 'fallback' };
}

// ── 5 Test Campaign Scenarios ──────────────────────────────────────────────
// These simulate what the news pipeline would pass to the image resolver.
// Each scenario is designed to exercise different tiers.

const TEST_CAMPAIGNS: Array<{
  label: string;
  ctx: ImageResolverContext;
  expectedTier: string;
}> = [
  {
    // Scenario 1: Real GNews-style article with a valid image URL.
    // Expected: Tier 1 (news source image) if the image is still live,
    //           Tier 2 (OG) if the GNews image is stale/broken.
    label: 'Medical: Cancer patient in California',
    ctx: {
      newsImageUrl: 'https://images.unsplash.com/photo-1550792404-f62d4ce3bb3e?w=600',
      articleUrl: 'https://www.nbcnews.com/health',
      category: 'medical',
      subjectName: 'Maria Gonzalez',
      event: 'diagnosed with rare cancer needs treatment',
      location: 'Los Angeles, CA',
    },
    expectedTier: 'Tier 1 (news) or Tier 2 (og_meta)',
  },
  {
    // Scenario 2: Article URL exists but no direct image URL from API.
    // The article page should have og:image in its HTML.
    // Expected: Tier 2 (OG/meta extraction from article page).
    label: 'Disaster: Tornado devastation in Oklahoma',
    ctx: {
      newsImageUrl: undefined, // GNews didn't provide an image
      articleUrl: 'https://www.cnn.com/weather',
      category: 'disaster',
      subjectName: 'The Johnson Family',
      event: 'tornado destroyed family home and community center',
      location: 'Moore, OK',
    },
    expectedTier: 'Tier 2 (og_meta) from CNN weather page',
  },
  {
    // Scenario 3: Both news image and article URL are broken/gone.
    // Should fall through to Unsplash contextual search.
    // Expected: Tier 3 (Unsplash) if API key set, else Tier 5.
    label: 'Military: Fallen soldier tribute',
    ctx: {
      newsImageUrl: 'https://completely-broken-domain-12345.example.com/image.jpg',
      articleUrl: 'https://completely-broken-domain-12345.example.com/article',
      category: 'military',
      subjectName: 'SGT James Williams',
      event: 'killed in training accident at Fort Liberty',
      location: 'Fort Liberty, NC',
    },
    expectedTier: 'Tier 3 (unsplash) or Tier 5 (fallback)',
  },
  {
    // Scenario 4: No news image, article URL is a 404.
    // Both Unsplash and Pexels should be tried.
    // Expected: Tier 3/4 if API keys set, else Tier 5.
    label: 'Veterans: Homeless veteran needs housing',
    ctx: {
      newsImageUrl: undefined,
      articleUrl: 'https://httpstat.us/404', // guaranteed 404
      category: 'veterans',
      subjectName: 'Robert Thompson',
      event: 'homeless veteran sleeping under bridge needs housing assistance',
      location: 'Portland, OR',
    },
    expectedTier: 'Tier 3/4 (stock photo) or Tier 5 (fallback)',
  },
  {
    // Scenario 5: Nothing available at all. No news image, no article URL.
    // Expected: Tier 5 (category fallback SVG).
    label: 'Memorial: Community remembers lost neighbor',
    ctx: {
      newsImageUrl: undefined,
      articleUrl: undefined,
      category: 'memorial',
      subjectName: 'David Chen',
      event: 'community memorial service for beloved teacher',
      location: 'Austin, TX',
    },
    expectedTier: 'Tier 5 (fallback SVG)',
  },
];

// ── Run ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(80));
  console.log('  IMAGE RESOLVER DIAGNOSTIC: 5 Campaign Scenarios');
  console.log('='.repeat(80));
  console.log();

  // Show API key status
  console.log('API Key Status:');
  console.log(`  UNSPLASH_ACCESS_KEY: ${process.env.UNSPLASH_ACCESS_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`  PEXELS_API_KEY:      ${process.env.PEXELS_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log();

  const results: Array<{ label: string; result: ImageResolution; query: string; elapsed: number }> = [];

  for (let i = 0; i < TEST_CAMPAIGNS.length; i++) {
    const { label, ctx, expectedTier } = TEST_CAMPAIGNS[i];
    console.log(`${'─'.repeat(80)}`);
    console.log(`Campaign ${i + 1}: ${label}`);
    console.log(`  Category:     ${ctx.category}`);
    console.log(`  News Image:   ${ctx.newsImageUrl ?? '(none)'}`);
    console.log(`  Article URL:  ${ctx.articleUrl ?? '(none)'}`);
    console.log(`  Subject:      ${ctx.subjectName ?? '(none)'}`);
    console.log(`  Event:        ${ctx.event ?? '(none)'}`);
    console.log(`  Location:     ${ctx.location ?? '(none)'}`);
    console.log(`  Expected:     ${expectedTier}`);
    console.log();

    const query = buildStockPhotoQuery(ctx);
    console.log(`  Stock query:  "${query}"`);

    const start = Date.now();
    const result = await resolveHeroImageEnhanced(ctx);
    const elapsed = Date.now() - start;

    results.push({ label, result, query, elapsed });

    const tierLabel = {
      news: 'TIER 1 (News Source)',
      og_meta: 'TIER 2 (OG/Meta)',
      unsplash: 'TIER 3 (Unsplash)',
      pexels: 'TIER 4 (Pexels)',
      fallback: 'TIER 5 (Category Fallback)',
    }[result.source];

    console.log();
    console.log(`  RESULT:       ${tierLabel}`);
    console.log(`  URL:          ${result.url.slice(0, 100)}${result.url.length > 100 ? '...' : ''}`);
    console.log(`  Credit:       ${result.credit ?? '(none)'}`);
    console.log(`  Time:         ${elapsed}ms`);
    console.log();
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log();

  const tierCounts: Record<string, number> = {};
  for (const { result } of results) {
    tierCounts[result.source] = (tierCounts[result.source] ?? 0) + 1;
  }

  console.log('Tier Distribution:');
  for (const [tier, count] of Object.entries(tierCounts)) {
    const bar = '\u2588'.repeat(count * 10);
    console.log(`  ${tier.padEnd(10)} ${bar} ${count}/5`);
  }
  console.log();

  console.log('Per-Campaign Results:');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const icon = r.result.source === 'fallback' ? '\u26A0' : '\u2713';
    console.log(`  ${icon} Campaign ${i + 1}: ${r.result.source.padEnd(10)} ${r.elapsed}ms  ${r.label}`);
  }

  console.log();
  const avgMs = Math.round(results.reduce((s, r) => s + r.elapsed, 0) / results.length);
  console.log(`Average resolution time: ${avgMs}ms`);
  console.log();

  const fallbackCount = tierCounts['fallback'] ?? 0;
  if (fallbackCount === 5) {
    console.log('NOTE: All 5 campaigns fell back to Tier 5. This is expected if');
    console.log('UNSPLASH_ACCESS_KEY and PEXELS_API_KEY are not set in .env.local.');
    console.log('With API keys configured, campaigns 3-4 would resolve from Tier 3/4.');
  } else if (fallbackCount === 0) {
    console.log('All 5 campaigns resolved with real images (no fallbacks). Excellent.');
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
