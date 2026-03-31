import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchArticleBody } from '@/lib/news/fetch-article-body';

describe('fetchArticleBody', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fallback when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const result = await fetchArticleBody('https://example.com/article', 'fallback text');
    expect(result).toBe('fallback text');
  });

  it('returns fallback when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    const result = await fetchArticleBody('https://example.com/article', 'fallback text');
    expect(result).toBe('fallback text');
  });

  it('extracts text from ld+json NewsArticle', async () => {
    const html = `
      <html><body>
      <script type="application/ld+json">
      {"@type":"NewsArticle","articleBody":"This is the full article body text extracted from structured data. It has enough length to be meaningful and useful for classification and entity extraction purposes."}
      </script>
      <p>Short paragraph</p>
      </body></html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await fetchArticleBody('https://example.com/article', 'short fallback');
    expect(result).toContain('This is the full article body text');
  });

  it('extracts text from <p> tags when no ld+json', async () => {
    const html = `
      <html><body>
      <article>
        <p>This is the first paragraph of the article with enough text to be meaningful for classification purposes.</p>
        <p>This is the second paragraph with additional details about the story being covered by the news outlet.</p>
      </article>
      </body></html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await fetchArticleBody('https://example.com/article', 'short');
    expect(result).toContain('first paragraph');
    expect(result).toContain('second paragraph');
  });

  it('returns fallback when extracted text is too short', async () => {
    const html = `<html><body><p>Hi</p></body></html>`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const fallback = 'A decent length fallback summary that already contains useful info';
    const result = await fetchArticleBody('https://example.com/article', fallback);
    expect(result).toBe(fallback);
  });
});
