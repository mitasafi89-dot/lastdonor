import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateBlogImage,
  getFallbackImage,
  buildSearchQuery,
  type BlogImageRequest,
} from './image-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const heroRequest: BlogImageRequest = {
  type: 'hero',
  blogTitle: 'How to Help Medical Fundraisers',
  causeCategory: 'medical',
  slug: 'how-to-help-medical-fundraisers',
};

const sectionRequest: BlogImageRequest = {
  type: 'section',
  blogTitle: 'How to Help Medical Fundraisers',
  sectionHeading: 'Understanding Insurance Gaps',
  causeCategory: 'medical',
  slug: 'how-to-help-medical-fundraisers',
  sectionIndex: 0,
};

function mockUnsplashResponse(photo = {}) {
  return {
    ok: true,
    json: async () => ({
      total: 1,
      results: [
        {
          id: 'abc123',
          urls: { raw: 'https://images.unsplash.com/photo-abc123' },
          links: { download_location: 'https://api.unsplash.com/photos/abc123/download' },
          user: {
            name: 'Jane Doe',
            links: { html: 'https://unsplash.com/@janedoe' },
          },
          alt_description: 'Medical equipment',
          ...photo,
        },
      ],
    }),
  };
}

function mockPexelsResponse(photo = {}) {
  return {
    ok: true,
    json: async () => ({
      photos: [
        {
          id: 42,
          photographer: 'John Smith',
          photographer_url: 'https://www.pexels.com/@johnsmith',
          alt: 'Healthcare scene',
          src: { original: 'https://images.pexels.com/photos/42/pexels-photo-42.jpeg' },
          ...photo,
        },
      ],
    }),
  };
}

function mockEmptyResponse() {
  return { ok: true, json: async () => ({ total: 0, results: [], photos: [] }) };
}

function mockFailResponse(status = 429) {
  return { ok: false, status, json: async () => ({}) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('image-generator', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-unsplash-key';
    process.env.PEXELS_API_KEY = 'test-pexels-key';
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.UNSPLASH_ACCESS_KEY = originalEnv.UNSPLASH_ACCESS_KEY;
    process.env.PEXELS_API_KEY = originalEnv.PEXELS_API_KEY;
  });

  // =========================================================================
  // buildSearchQuery
  // =========================================================================

  describe('buildSearchQuery', () => {
    it('returns category query for hero images', () => {
      const query = buildSearchQuery(heroRequest);
      expect(query).toBe('medical healthcare healing support');
    });

    it('incorporates section heading words for section images', () => {
      const query = buildSearchQuery(sectionRequest);
      expect(query).toContain('Understanding Insurance Gaps');
      expect(query).toContain('medical');
    });

    it('truncates long headings to 3 words', () => {
      const query = buildSearchQuery({
        ...sectionRequest,
        sectionHeading: 'The Complete Definitive Guide to Understanding Complex Insurance',
      });
      const words = query.split(' ');
      // 3 heading words + 2 base words
      expect(words.length).toBeLessThanOrEqual(6);
    });

    it('falls back to community for unknown categories', () => {
      const query = buildSearchQuery({ ...heroRequest, causeCategory: 'unknown-category' });
      expect(query).toBe('community togetherness neighborhood');
    });

    it('covers all 23 categories', () => {
      const categories = [
        'medical', 'disaster', 'military', 'veterans', 'memorial',
        'first-responders', 'community', 'essential-needs', 'education',
        'animal', 'emergency', 'family', 'faith', 'environment', 'sports',
        'creative', 'funeral', 'addiction', 'elderly', 'justice', 'housing',
        'mental-health', 'wishes',
      ];
      for (const cat of categories) {
        const query = buildSearchQuery({ ...heroRequest, causeCategory: cat });
        expect(query.length).toBeGreaterThan(0);
        // Should not fall back to community
        if (cat !== 'community') {
          expect(query).not.toBe('community togetherness neighborhood');
        }
      }
    });
  });

  // =========================================================================
  // generateBlogImage - Unsplash path
  // =========================================================================

  describe('generateBlogImage - Unsplash', () => {
    it('returns Unsplash result with correct dimensions and attribution', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse()) // search
        .mockResolvedValueOnce({ ok: true }); // download tracking

      globalThis.fetch = fetchMock;

      const result = await generateBlogImage(heroRequest);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('unsplash');
      expect(result!.width).toBe(1200);
      expect(result!.height).toBe(630);
      expect(result!.url).toContain('w=1200');
      expect(result!.url).toContain('h=630');
      expect(result!.url).toContain('fit=crop');
      expect(result!.attribution).toContain('Jane Doe');
      expect(result!.attribution).toContain('Unsplash');
      expect(result!.altText).toContain(heroRequest.blogTitle);
    });

    it('sends correct auth header', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse())
        .mockResolvedValueOnce({ ok: true });

      globalThis.fetch = fetchMock;
      await generateBlogImage(heroRequest);

      const [url, opts] = fetchMock.mock.calls[0]!;
      expect(url).toContain('api.unsplash.com/search/photos');
      expect(opts.headers.Authorization).toBe('Client-ID test-unsplash-key');
    });

    it('requests landscape for hero/section, portrait for infographic', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValue(mockUnsplashResponse());
      globalThis.fetch = fetchMock;

      await generateBlogImage(heroRequest);
      expect(fetchMock.mock.calls[0]![0]).toContain('orientation=landscape');

      fetchMock.mockClear();
      await generateBlogImage({ ...heroRequest, type: 'infographic' });
      expect(fetchMock.mock.calls[0]![0]).toContain('orientation=portrait');
    });

    it('triggers download tracking (fire-and-forget)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse())
        .mockResolvedValueOnce({ ok: true }); // tracking call

      globalThis.fetch = fetchMock;
      await generateBlogImage(heroRequest);

      // Second call should be the download tracking
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]![0]).toContain('download');
    });

    it('uses content_filter=high', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse())
        .mockResolvedValueOnce({ ok: true });

      await generateBlogImage(heroRequest);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      expect(url).toContain('content_filter=high');
    });
  });

  // =========================================================================
  // generateBlogImage - Pexels fallback
  // =========================================================================

  describe('generateBlogImage - Pexels fallback', () => {
    it('falls back to Pexels when Unsplash returns no results', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(mockEmptyResponse()) // Unsplash empty
        .mockResolvedValueOnce(mockPexelsResponse()); // Pexels OK

      const result = await generateBlogImage(heroRequest);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('pexels');
      expect(result!.attribution).toContain('John Smith');
      expect(result!.attribution).toContain('Pexels');
    });

    it('falls back to Pexels when Unsplash fails', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(mockFailResponse(500)) // Unsplash 500
        .mockResolvedValueOnce(mockPexelsResponse()); // Pexels OK

      const result = await generateBlogImage(heroRequest);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('pexels');
    });

    it('only uses Pexels when no Unsplash key', async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;

      globalThis.fetch = vi.fn().mockResolvedValueOnce(mockPexelsResponse());

      const result = await generateBlogImage(heroRequest);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('pexels');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain('pexels.com');
    });

    it('returns correct Pexels URL with dimensions', async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;

      globalThis.fetch = vi.fn().mockResolvedValueOnce(mockPexelsResponse());

      const result = await generateBlogImage(heroRequest);
      expect(result!.url).toContain('w=1200');
      expect(result!.url).toContain('h=630');
      expect(result!.url).toContain('auto=compress');
    });
  });

  // =========================================================================
  // generateBlogImage - no-key / both-fail paths
  // =========================================================================

  describe('generateBlogImage - edge cases', () => {
    it('returns null when no API keys configured', async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;
      delete process.env.PEXELS_API_KEY;

      const result = await generateBlogImage(heroRequest);
      expect(result).toBeNull();
    });

    it('returns null when both APIs return empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockEmptyResponse());

      const result = await generateBlogImage(heroRequest);
      expect(result).toBeNull();
    });

    it('retries up to MAX_RETRIES on failure', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockEmptyResponse());
      globalThis.fetch = fetchMock;

      await generateBlogImage(heroRequest);

      // 3 attempts (0, 1, 2) x 2 APIs = 6 calls
      expect(fetchMock.mock.calls.length).toBe(6);
    });

    it('handles fetch throwing errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await generateBlogImage(heroRequest);
      expect(result).toBeNull();
    });

    it('varies page for section images by sectionIndex', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse())
        .mockResolvedValueOnce({ ok: true });
      globalThis.fetch = fetchMock;

      await generateBlogImage({ ...sectionRequest, sectionIndex: 2 });

      const url = fetchMock.mock.calls[0]![0] as string;
      // page = sectionIndex + 1 = 3
      expect(url).toContain('page=3');
    });
  });

  // =========================================================================
  // generateBlogImage - section image dimensions
  // =========================================================================

  describe('generateBlogImage - image types', () => {
    it('uses 800x450 for section images', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse())
        .mockResolvedValueOnce({ ok: true });

      const result = await generateBlogImage(sectionRequest);
      expect(result!.width).toBe(800);
      expect(result!.height).toBe(450);
    });

    it('uses 800x1067 for infographic images', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse())
        .mockResolvedValueOnce({ ok: true });

      const result = await generateBlogImage({ ...heroRequest, type: 'infographic' });
      expect(result!.width).toBe(800);
      expect(result!.height).toBe(1067);
    });
  });

  // =========================================================================
  // getFallbackImage
  // =========================================================================

  describe('getFallbackImage', () => {
    it('returns OG-based fallback URL', () => {
      const result = getFallbackImage('medical');
      expect(result.url).toContain('/api/v1/og/page');
      expect(result.url).toContain('medical');
      expect(result.source).toBe('default');
    });

    it('uses hero dimensions by default', () => {
      const result = getFallbackImage('medical');
      expect(result.width).toBe(1200);
      expect(result.height).toBe(630);
    });

    it('uses section dimensions when specified', () => {
      const result = getFallbackImage('medical', 'section');
      expect(result.width).toBe(800);
      expect(result.height).toBe(450);
    });

    it('formats hyphenated categories as spaces in URL', () => {
      const result = getFallbackImage('mental-health');
      expect(result.url).toContain('mental%20health');
    });

    it('includes altText with category name', () => {
      const result = getFallbackImage('first-responders');
      expect(result.altText).toContain('first responders');
    });
  });

  // =========================================================================
  // BlogImageResult contract
  // =========================================================================

  describe('BlogImageResult contract', () => {
    it('includes attribution field for Unsplash results', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(mockUnsplashResponse())
        .mockResolvedValueOnce({ ok: true });

      const result = await generateBlogImage(heroRequest);
      expect(result!.attribution).toBeDefined();
      expect(result!.attribution).toContain('utm_source=lastdonor');
    });

    it('includes attribution field for Pexels results', async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;
      globalThis.fetch = vi.fn().mockResolvedValueOnce(mockPexelsResponse());

      const result = await generateBlogImage(heroRequest);
      expect(result!.attribution).toBeDefined();
      expect(result!.attribution).toContain('pexels.com');
    });

    it('getFallbackImage does not include attribution', () => {
      const result = getFallbackImage('medical');
      expect(result.attribution).toBeUndefined();
    });
  });
});
