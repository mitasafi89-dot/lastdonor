/**
 * Blog Image Generator - Free stock photo integration (Unsplash + Pexels).
 *
 * Primary: Unsplash API (50 req/hr demo, 5000/hr production).
 * Fallback: Pexels API (200 req/hr, 20,000/month).
 * Images are hotlinked from provider CDNs (no upload/storage cost).
 * Attribution is required by both APIs and included in results.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlogImageRequest {
  type: 'hero' | 'section' | 'infographic';
  blogTitle: string;
  sectionHeading?: string;
  causeCategory: string;
  slug: string;
  sectionIndex?: number;
}

export interface BlogImageResult {
  url: string;
  altText: string;
  width: number;
  height: number;
  source: 'unsplash' | 'pexels' | 'fallback' | 'default';
  attribution?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

const IMAGE_DIMENSIONS: Record<string, { width: number; height: number; ratio: string }> = {
  hero: { width: 1200, height: 630, ratio: '16:9' },
  section: { width: 800, height: 450, ratio: '16:9' },
  infographic: { width: 800, height: 1067, ratio: '3:4' },
};

// ---------------------------------------------------------------------------
// Category Search Queries
// ---------------------------------------------------------------------------

const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  medical: 'medical healthcare healing support',
  disaster: 'community resilience rebuilding hope',
  military: 'military service honor tribute',
  veterans: 'veteran transition new beginning',
  memorial: 'memorial remembrance tribute light',
  'first-responders': 'first responder emergency service',
  community: 'community togetherness neighborhood',
  'essential-needs': 'shelter food humanitarian aid',
  education: 'education learning growth books',
  animal: 'animal rescue care compassion',
  emergency: 'emergency relief crisis response',
  family: 'family togetherness bond love',
  faith: 'faith community spiritual devotion',
  environment: 'nature sustainability conservation',
  sports: 'sports teamwork athletic determination',
  creative: 'art creative expression inspiration',
  funeral: 'memorial celebration life tribute',
  addiction: 'recovery healing journey freedom',
  elderly: 'elderly care senior dignity',
  justice: 'justice advocacy equality fairness',
  housing: 'housing shelter home stability',
  'mental-health': 'mental health wellness peace calm',
  wishes: 'wishes dreams joy celebration',
};

// ---------------------------------------------------------------------------
// Unsplash API
// ---------------------------------------------------------------------------

interface UnsplashPhoto {
  id: string;
  urls: { raw: string };
  links: { download_location: string };
  user: { name: string; links: { html: string } };
  alt_description: string | null;
}

interface UnsplashSearchResponse {
  total: number;
  results: UnsplashPhoto[];
}

async function searchUnsplash(
  query: string,
  orientation: 'landscape' | 'portrait',
  page: number = 1,
): Promise<UnsplashPhoto | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const params = new URLSearchParams({
    query,
    orientation,
    per_page: '1',
    page: String(page),
    content_filter: 'high',
  });

  const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  });

  if (!response.ok) {
    console.error(`Unsplash search failed: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as UnsplashSearchResponse;
  return data.results[0] ?? null;
}

function buildUnsplashUrl(photo: UnsplashPhoto, width: number, height: number): string {
  return `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&auto=format&q=80`;
}

/** Trigger Unsplash download tracking (required by API guidelines, fire-and-forget). */
function trackUnsplashDownload(photo: UnsplashPhoto): void {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return;

  fetch(photo.links.download_location, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  }).catch(() => {
    // Non-critical tracking, ignore errors
  });
}

// ---------------------------------------------------------------------------
// Pexels API
// ---------------------------------------------------------------------------

interface PexelsPhoto {
  id: number;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: { original: string };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

async function searchPexels(
  query: string,
  orientation: 'landscape' | 'portrait',
  page: number = 1,
): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    query,
    orientation,
    per_page: '1',
    page: String(page),
  });

  const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    console.error(`Pexels search failed: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as PexelsSearchResponse;
  return data.photos[0] ?? null;
}

function buildPexelsUrl(photo: PexelsPhoto, width: number, height: number): string {
  return `${photo.src.original}?auto=compress&cs=tinysrgb&w=${width}&h=${height}&fit=crop`;
}

// ---------------------------------------------------------------------------
// Search Query Builder
// ---------------------------------------------------------------------------

export function buildSearchQuery(request: BlogImageRequest): string {
  const baseQuery =
    CATEGORY_SEARCH_QUERIES[request.causeCategory] ?? CATEGORY_SEARCH_QUERIES.community!;

  if (request.type === 'section' && request.sectionHeading) {
    const headingWords = request.sectionHeading
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 3)
      .join(' ');
    return `${headingWords} ${baseQuery.split(' ').slice(0, 2).join(' ')}`;
  }

  return baseQuery;
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

export async function generateBlogImage(
  request: BlogImageRequest,
): Promise<BlogImageResult | null> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  if (!unsplashKey && !pexelsKey) {
    return null;
  }

  const dims = IMAGE_DIMENSIONS[request.type]!;
  const query = buildSearchQuery(request);
  const orientation: 'landscape' | 'portrait' =
    request.type === 'infographic' ? 'portrait' : 'landscape';

  // Vary result page for section images to get visually distinct photos
  const page = request.sectionIndex !== undefined ? request.sectionIndex + 1 : 1;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.warn(`Image search retry ${attempt}/${MAX_RETRIES} for ${request.slug}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }

      // Try Unsplash first
      if (unsplashKey) {
        const photo = await searchUnsplash(query, orientation, page + attempt);
        if (photo) {
          trackUnsplashDownload(photo);
          return {
            url: buildUnsplashUrl(photo, dims.width, dims.height),
            altText: generateAltText(request),
            width: dims.width,
            height: dims.height,
            source: 'unsplash',
            attribution: `Photo by <a href="${photo.user.links.html}?utm_source=lastdonor&utm_medium=referral">${photo.user.name}</a> on <a href="https://unsplash.com/?utm_source=lastdonor&utm_medium=referral">Unsplash</a>`,
          };
        }
      }

      // Fall back to Pexels
      if (pexelsKey) {
        const photo = await searchPexels(query, orientation, page + attempt);
        if (photo) {
          return {
            url: buildPexelsUrl(photo, dims.width, dims.height),
            altText: generateAltText(request),
            width: dims.width,
            height: dims.height,
            source: 'pexels',
            attribution: `Photo by <a href="${photo.photographer_url}">${photo.photographer}</a> on <a href="https://www.pexels.com">Pexels</a>`,
          };
        }
      }
    } catch (error) {
      console.error(`Image search attempt ${attempt} error:`, error);
    }
  }

  return null;
}

/**
 * Get a fallback image URL based on the blog post's category.
 */
export function getFallbackImage(
  causeCategory: string,
  type: 'hero' | 'section' = 'hero',
): BlogImageResult {
  const dims = IMAGE_DIMENSIONS[type]!;

  const title = encodeURIComponent(causeCategory.replace(/-/g, ' '));
  const url = `/api/v1/og/page?title=${title}&subtitle=LastDonor.org`;

  return {
    url,
    altText: `${causeCategory.replace(/-/g, ' ')} illustration`,
    width: dims.width,
    height: dims.height,
    source: 'default',
  };
}

function generateAltText(request: BlogImageRequest): string {
  const category = request.causeCategory.replace(/-/g, ' ');
  if (request.type === 'hero') {
    return `Illustration for ${request.blogTitle}`;
  }
  if (request.type === 'section' && request.sectionHeading) {
    return `${category} illustration: ${request.sectionHeading}`;
  }
  return `${category} blog illustration`;
}
