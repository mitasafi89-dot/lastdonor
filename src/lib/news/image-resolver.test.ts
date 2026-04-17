import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveHeroImageEnhanced,
  extractImageCandidates,
  buildStockPhotoQuery,
  type ImageResolverContext,
} from '@/lib/news/image-resolver';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockFetchResponses(responses: Map<string, Partial<Response>>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();

    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        return response as Response;
      }
    }

    // Default: network error
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function headResponse(ok: boolean, contentType = 'image/jpeg', contentLength = '50000') {
  return {
    ok,
    status: ok ? 200 : 404,
    headers: new Headers({
      'content-type': contentType,
      'content-length': contentLength,
    }),
  } as unknown as Response;
}

function htmlResponse(html: string) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(html),
    headers: new Headers({ 'content-type': 'text/html' }),
  } as unknown as Response;
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

const BASE_CTX: ImageResolverContext = {
  category: 'medical',
  subjectName: 'John Smith',
  event: 'house fire destroyed home',
  location: 'Portland, OR',
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('image-resolver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear env vars
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.PEXELS_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── extractImageCandidates ──────────────────────────────────────────────

  describe('extractImageCandidates', () => {
    it('extracts og:image from HTML', () => {
      const html = `<html><head>
        <meta property="og:image" content="https://cdn.example.com/hero.jpg">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/hero.jpg']);
    });

    it('extracts og:image with content before property', () => {
      const html = `<html><head>
        <meta content="https://cdn.example.com/hero.jpg" property="og:image">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/hero.jpg']);
    });

    it('extracts twitter:image', () => {
      const html = `<html><head>
        <meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/twitter.jpg']);
    });

    it('extracts twitter:image:src variant', () => {
      const html = `<html><head>
        <meta name="twitter:image:src" content="https://cdn.example.com/twitter-src.jpg">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/twitter-src.jpg']);
    });

    it('extracts LD+JSON image (string)', () => {
      const html = `<html><head>
        <script type="application/ld+json">
        {"@type":"NewsArticle","image":"https://cdn.example.com/ldjson.jpg","headline":"Test"}
        </script>
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/ldjson.jpg']);
    });

    it('extracts LD+JSON image (array)', () => {
      const html = `<html><head>
        <script type="application/ld+json">
        {"@type":"Article","image":["https://cdn.example.com/a.jpg","https://cdn.example.com/b.jpg"]}
        </script>
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toContain('https://cdn.example.com/a.jpg');
      expect(candidates).toContain('https://cdn.example.com/b.jpg');
    });

    it('extracts LD+JSON image (ImageObject with url)', () => {
      const html = `<html><head>
        <script type="application/ld+json">
        {"@type":"NewsArticle","image":{"@type":"ImageObject","url":"https://cdn.example.com/obj.jpg"}}
        </script>
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/obj.jpg']);
    });

    it('extracts LD+JSON thumbnailUrl', () => {
      const html = `<html><head>
        <script type="application/ld+json">
        {"@type":"NewsArticle","thumbnailUrl":"https://cdn.example.com/thumb.jpg"}
        </script>
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/thumb.jpg']);
    });

    it('deduplicates identical URLs across sources', () => {
      const html = `<html><head>
        <meta property="og:image" content="https://cdn.example.com/same.jpg">
        <meta name="twitter:image" content="https://cdn.example.com/same.jpg">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/same.jpg']);
    });

    it('maintains priority order: og > twitter > ld+json', () => {
      const html = `<html><head>
        <meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">
        <meta property="og:image" content="https://cdn.example.com/og.jpg">
        <script type="application/ld+json">
        {"@type":"NewsArticle","image":"https://cdn.example.com/ldjson.jpg"}
        </script>
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates[0]).toBe('https://cdn.example.com/og.jpg');
      expect(candidates[1]).toBe('https://cdn.example.com/twitter.jpg');
      expect(candidates[2]).toBe('https://cdn.example.com/ldjson.jpg');
    });

    it('rejects non-HTTPS URLs', () => {
      const html = `<html><head>
        <meta property="og:image" content="http://insecure.example.com/img.jpg">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual([]);
    });

    it('rejects favicon/logo URLs', () => {
      const html = `<html><head>
        <meta property="og:image" content="https://cdn.example.com/favicon.png">
        <meta name="twitter:image" content="https://cdn.example.com/site-logo.png">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual([]);
    });

    it('rejects .ico files', () => {
      const html = `<html><head>
        <meta property="og:image" content="https://cdn.example.com/icon.ico">
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual([]);
    });

    it('returns empty array for HTML with no image metadata', () => {
      const html = `<html><head><title>No images</title></head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual([]);
    });

    it('handles invalid LD+JSON gracefully', () => {
      const html = `<html><head>
        <meta property="og:image" content="https://cdn.example.com/valid.jpg">
        <script type="application/ld+json">{invalid json}</script>
      </head></html>`;
      const candidates = extractImageCandidates(html);
      expect(candidates).toEqual(['https://cdn.example.com/valid.jpg']);
    });
  });

  // ── buildStockPhotoQuery ────────────────────────────────────────────────

  describe('buildStockPhotoQuery', () => {
    it('includes event keywords when available', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        event: 'house fire destroyed family home',
      });
      expect(query).toContain('house');
      expect(query).toContain('fire');
      expect(query).toContain('destroyed');
    });

    it('includes location when not "Unknown"', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        location: 'Portland, OR',
      });
      expect(query).toContain('Portland');
    });

    it('excludes location when "Unknown"', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        location: 'Unknown',
      });
      expect(query).not.toContain('Unknown');
    });

    it('includes category-specific emotional framing', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        category: 'disaster',
      });
      expect(query).toContain('community');
      expect(query).toContain('rebuilding');
    });

    it('falls back to generic framing for unknown categories', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        category: 'nonexistent_category',
      });
      expect(query).toContain('community');
      expect(query).toContain('support');
    });

    it('strips stop words from event description', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        event: 'the family was in a terrible accident on the highway',
      });
      expect(query).not.toContain('the');
      expect(query).not.toContain('was');
      expect(query).toContain('family');
    });

    it('limits event keywords to 3 terms', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        event: 'massive earthquake destroyed buildings bridges roads infrastructure schools hospitals',
      });
      // Should have at most 3 event keywords
      const beforeFraming = query.split('hospital recovery')[0] ?? query;
      const eventWords = beforeFraming.trim().split(/\s+/).filter((w) => w.length > 2);
      // Event keywords + location = at most ~5 words before framing
      expect(eventWords.length).toBeLessThanOrEqual(5);
    });

    it('limits total query length to 100 chars', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        event: 'catastrophic earthquake tsunami flood tornado hurricane wildfire volcanic eruption landslide',
        location: 'San Francisco Bay Area Metropolitan Region, California, United States',
      });
      expect(query.length).toBeLessThanOrEqual(100);
    });

    it('handles missing event gracefully', () => {
      const query = buildStockPhotoQuery({
        ...BASE_CTX,
        event: undefined,
      });
      // Should still have category framing
      expect(query.length).toBeGreaterThan(10);
      expect(query).toContain('recovery');
    });
  });

  // ── resolveHeroImageEnhanced (integration) ──────────────────────────────

  describe('resolveHeroImageEnhanced', () => {
    it('Tier 1: uses news source image when valid and large enough', async () => {
      mockFetchResponses(new Map([
        ['https://news.example.com/photo.jpg', headResponse(true, 'image/jpeg', '80000')],
      ]));

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/photo.jpg',
      });

      expect(result.source).toBe('news');
      expect(result.url).toBe('https://news.example.com/photo.jpg');
      expect(result.credit).toBeNull();
    });

    it('Tier 1: rejects news image smaller than 5KB', async () => {
      const responses = new Map<string, Partial<Response>>();
      responses.set('https://news.example.com/tiny.jpg', headResponse(true, 'image/jpeg', '2000'));
      // Tier 2 article fetch also fails
      responses.set('https://article.example.com', { ok: false, status: 403 } as Response);

      mockFetchResponses(responses);

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/tiny.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      // Should not be 'news' tier since the image was too small
      expect(result.source).not.toBe('news');
    });

    it('Tier 2: extracts OG image when news image fails', async () => {
      const articleHtml = `<html><head>
        <meta property="og:image" content="https://cdn.news.com/og-hero.jpg">
      </head></html>`;

      const responses = new Map<string, Partial<Response>>();
      responses.set('https://news.example.com/broken.jpg', headResponse(false));
      responses.set('https://article.example.com', htmlResponse(articleHtml));
      responses.set('https://cdn.news.com/og-hero.jpg', headResponse(true, 'image/jpeg', '75000'));

      mockFetchResponses(responses);

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      expect(result.source).toBe('og_meta');
      expect(result.url).toBe('https://cdn.news.com/og-hero.jpg');
      expect(result.credit).toBeNull();
    });

    it('Tier 2: tries multiple OG candidates in priority order', async () => {
      const articleHtml = `<html><head>
        <meta property="og:image" content="https://cdn.news.com/og-broken.jpg">
        <meta name="twitter:image" content="https://cdn.news.com/twitter-works.jpg">
      </head></html>`;

      const responses = new Map<string, Partial<Response>>();
      responses.set('https://news.example.com/broken.jpg', headResponse(false));
      responses.set('https://article.example.com', htmlResponse(articleHtml));
      responses.set('https://cdn.news.com/og-broken.jpg', headResponse(false));
      responses.set('https://cdn.news.com/twitter-works.jpg', headResponse(true, 'image/jpeg', '60000'));

      mockFetchResponses(responses);

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      expect(result.source).toBe('og_meta');
      expect(result.url).toBe('https://cdn.news.com/twitter-works.jpg');
    });

    it('Tier 3: searches Unsplash when news + OG both fail', async () => {
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';

      const responses = new Map<string, Partial<Response>>();
      responses.set('https://news.example.com/broken.jpg', headResponse(false));
      responses.set('https://article.example.com', { ok: false, status: 404 } as Response);
      responses.set('api.unsplash.com', jsonResponse({
        results: [{
          urls: { raw: 'https://images.unsplash.com/photo-abc123' },
          user: { name: 'Jane Doe' },
        }],
      }));

      mockFetchResponses(responses);

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      expect(result.source).toBe('unsplash');
      expect(result.url).toContain('images.unsplash.com');
      expect(result.url).toContain('w=800');
      expect(result.credit).toBe('Photo by Jane Doe on Unsplash');
    });

    it('Tier 4: searches Pexels when Unsplash also fails', async () => {
      process.env.PEXELS_API_KEY = 'test-pexels-key';

      const responses = new Map<string, Partial<Response>>();
      responses.set('https://news.example.com/broken.jpg', headResponse(false));
      responses.set('https://article.example.com', { ok: false, status: 404 } as Response);
      // No Unsplash key set
      responses.set('api.pexels.com', jsonResponse({
        photos: [{
          src: { original: 'https://images.pexels.com/photos/123456/pexels-photo-123456.jpeg' },
          photographer: 'John Photographer',
        }],
      }));

      mockFetchResponses(responses);

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      expect(result.source).toBe('pexels');
      expect(result.url).toContain('images.pexels.com');
      expect(result.credit).toBe('Photo by John Photographer on Pexels');
    });

    it('Tier 5: falls back to category SVG when all tiers fail', async () => {
      const responses = new Map<string, Partial<Response>>();
      responses.set('https://news.example.com/broken.jpg', headResponse(false));
      responses.set('https://article.example.com', { ok: false, status: 404 } as Response);

      mockFetchResponses(responses);

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      expect(result.source).toBe('fallback');
      expect(result.url).toContain('/images/categories/');
      expect(result.url).toContain('-default.svg');
      expect(result.credit).toBeNull();
    });

    it('skips Tier 2 when articleUrl is not provided', async () => {
      const fetchSpy = mockFetchResponses(new Map([
        ['https://news.example.com/broken.jpg', headResponse(false)],
      ]));

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        // No articleUrl
      });

      // Should go straight to fallback (no stock API keys set)
      expect(result.source).toBe('fallback');
      // Should NOT have fetched any article pages
      const articleFetches = fetchSpy.mock.calls.filter(
        (call) => !String(call[0]).includes('news.example.com'),
      );
      expect(articleFetches).toHaveLength(0);
    });

    it('skips Unsplash when UNSPLASH_ACCESS_KEY not set', async () => {
      const fetchSpy = mockFetchResponses(new Map([
        ['https://news.example.com/broken.jpg', headResponse(false)],
        ['https://article.example.com', { ok: false, status: 404 } as Response],
      ]));

      await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      const unsplashCalls = fetchSpy.mock.calls.filter(
        (call) => String(call[0]).includes('unsplash'),
      );
      expect(unsplashCalls).toHaveLength(0);
    });

    it('skips Pexels when PEXELS_API_KEY not set', async () => {
      const fetchSpy = mockFetchResponses(new Map([
        ['https://news.example.com/broken.jpg', headResponse(false)],
        ['https://article.example.com', { ok: false, status: 404 } as Response],
      ]));

      await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      const pexelsCalls = fetchSpy.mock.calls.filter(
        (call) => String(call[0]).includes('pexels'),
      );
      expect(pexelsCalls).toHaveLength(0);
    });

    it('accepts local path as news image without validation', async () => {
      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: '/images/categories/medical-hero.webp',
      });

      expect(result.source).toBe('news');
      expect(result.url).toBe('/images/categories/medical-hero.webp');
    });

    it('Tier 3: handles Unsplash returning empty results', async () => {
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';
      process.env.PEXELS_API_KEY = 'test-pexels-key';

      const responses = new Map<string, Partial<Response>>();
      responses.set('https://news.example.com/broken.jpg', headResponse(false));
      responses.set('https://article.example.com', { ok: false, status: 404 } as Response);
      responses.set('api.unsplash.com', jsonResponse({ results: [] }));
      responses.set('api.pexels.com', jsonResponse({
        photos: [{
          src: { original: 'https://images.pexels.com/photos/999/pexels.jpeg' },
          photographer: 'Backup Photo',
        }],
      }));

      mockFetchResponses(responses);

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      expect(result.source).toBe('pexels');
    });

    it('handles fetch network errors gracefully at every tier', async () => {
      process.env.UNSPLASH_ACCESS_KEY = 'test-key';
      process.env.PEXELS_API_KEY = 'test-pexels-key';

      // Everything throws
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/broken.jpg',
        articleUrl: 'https://article.example.com/story',
      });

      expect(result.source).toBe('fallback');
      expect(result.url).toContain('/images/categories/');
    });

    it('handles no newsImageUrl and no articleUrl', async () => {
      const result = await resolveHeroImageEnhanced({
        category: 'disaster',
      });

      expect(result.source).toBe('fallback');
      expect(result.url).toContain('disaster-default.svg');
    });

    it('maps aliased categories to correct fallback SVG', async () => {
      const result = await resolveHeroImageEnhanced({
        category: 'emergency', // Maps to 'disaster' in the fallback map
      });

      expect(result.source).toBe('fallback');
      expect(result.url).toContain('disaster-default.svg');
    });

    it('Tier 1: rejects non-image content types', async () => {
      mockFetchResponses(new Map([
        ['https://news.example.com/page.html', headResponse(true, 'text/html', '50000')],
      ]));

      const result = await resolveHeroImageEnhanced({
        ...BASE_CTX,
        newsImageUrl: 'https://news.example.com/page.html',
      });

      expect(result.source).not.toBe('news');
    });
  });
});
