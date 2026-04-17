/**
 * Article Assembler Tests
 *
 * Tests for post-processing fixes:
 *  - Em-dash/en-dash replacement preserves hyphens
 *  - Link extraction rejects dangerous URI schemes
 *  - Link extraction correctly classifies internal vs external links
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';

// Mock external deps that trigger initialization side-effects
vi.mock('@/lib/ai/call-ai', () => ({
  callAI: vi.fn(),
}));

vi.mock('@/lib/ai/openrouter', () => ({
  ai: {},
}));

import { replaceDashes, extractLinks } from './article-assembler';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Em-Dash / En-Dash Replacement
// ═══════════════════════════════════════════════════════════════════════════════

describe('replaceDashes', () => {
  // ─── Target: Unicode dashes should be replaced ────────────────────────

  it('replaces Unicode em dash (U+2014) with comma', () => {
    expect(replaceDashes('hello\u2014world')).toBe('hello,world');
  });

  it('replaces Unicode en dash (U+2013) with comma', () => {
    expect(replaceDashes('hello\u2013world')).toBe('hello,world');
  });

  it('replaces HTML entity &mdash; with comma', () => {
    expect(replaceDashes('hello&mdash;world')).toBe('hello,world');
  });

  it('replaces HTML entity &ndash; with comma', () => {
    expect(replaceDashes('hello&ndash;world')).toBe('hello,world');
  });

  it('replaces multiple dashes in a single string', () => {
    const input = 'First\u2014second\u2013third&mdash;fourth&ndash;fifth';
    expect(replaceDashes(input)).toBe('First,second,third,fourth,fifth');
  });

  // ─── Critical: Hyphens must be preserved ──────────────────────────────

  it('preserves regular hyphens (U+002D)', () => {
    expect(replaceDashes('25-year-old')).toBe('25-year-old');
  });

  it('preserves hyphens in URLs', () => {
    expect(replaceDashes('/campaigns/medical-fundraiser')).toBe('/campaigns/medical-fundraiser');
  });

  it('preserves hyphens in compound words', () => {
    expect(replaceDashes('well-known self-care cost-effective')).toBe('well-known self-care cost-effective');
  });

  it('preserves hyphens in date ranges', () => {
    expect(replaceDashes('2024-01-15')).toBe('2024-01-15');
  });

  it('preserves hyphens in phone numbers', () => {
    expect(replaceDashes('555-123-4567')).toBe('555-123-4567');
  });

  it('preserves hyphens in CSS classes embedded in HTML', () => {
    const html = '<div class="text-blue-500 p-4">content</div>';
    expect(replaceDashes(html)).toBe(html);
  });

  // ─── Mixed content: dashes replaced, hyphens kept ────────────────────

  it('replaces dashes while preserving hyphens in the same string', () => {
    const input = 'The 25-year-old patient\u2014who was self-employed\u2013needed help';
    const expected = 'The 25-year-old patient,who was self-employed,needed help';
    expect(replaceDashes(input)).toBe(expected);
  });

  it('handles HTML with mixed dash types', () => {
    const input = '<p>A 10-step guide&mdash;from start to finish&ndash;for first-time fundraisers</p>';
    const expected = '<p>A 10-step guide,from start to finish,for first-time fundraisers</p>';
    expect(replaceDashes(input)).toBe(expected);
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  it('returns empty string unchanged', () => {
    expect(replaceDashes('')).toBe('');
  });

  it('returns string with no dashes unchanged', () => {
    expect(replaceDashes('Hello world')).toBe('Hello world');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Link Extraction & Sanitization
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractLinks', () => {
  // ─── Internal links ───────────────────────────────────────────────────

  it('extracts internal links starting with /', () => {
    const html = '<a href="/campaigns/test">Test</a>';
    expect(extractLinks(html, true)).toEqual(['/campaigns/test']);
  });

  it('extracts internal links containing lastdonor.org', () => {
    const html = '<a href="https://lastdonor.org/blog/post-1">Read</a>';
    expect(extractLinks(html, true)).toEqual(['https://lastdonor.org/blog/post-1']);
  });

  it('returns empty array when no internal links exist', () => {
    const html = '<a href="https://google.com">Google</a>';
    expect(extractLinks(html, true)).toEqual([]);
  });

  // ─── External links ──────────────────────────────────────────────────

  it('extracts external links', () => {
    const html = '<a href="https://cancer.gov/treatment">NCI</a>';
    expect(extractLinks(html, false)).toEqual(['https://cancer.gov/treatment']);
  });

  it('does not include internal links in external results', () => {
    const html = '<a href="/blog/test">Test</a> <a href="https://example.com">Ex</a>';
    expect(extractLinks(html, false)).toEqual(['https://example.com']);
  });

  // ─── Deduplication ────────────────────────────────────────────────────

  it('deduplicates repeated links', () => {
    const html = '<a href="/blog/a">A</a> <a href="/blog/a">A again</a>';
    expect(extractLinks(html, true)).toEqual(['/blog/a']);
  });

  // ─── Dangerous scheme rejection (XSS prevention) ─────────────────────

  it('rejects javascript: scheme', () => {
    const html = '<a href="javascript:alert(1)">XSS</a>';
    expect(extractLinks(html, true)).toEqual([]);
    expect(extractLinks(html, false)).toEqual([]);
  });

  it('rejects data: scheme', () => {
    const html = '<a href="data:text/html,<script>alert(1)</script>">XSS</a>';
    expect(extractLinks(html, true)).toEqual([]);
    expect(extractLinks(html, false)).toEqual([]);
  });

  it('rejects vbscript: scheme', () => {
    const html = '<a href="vbscript:MsgBox(1)">XSS</a>';
    expect(extractLinks(html, true)).toEqual([]);
    expect(extractLinks(html, false)).toEqual([]);
  });

  it('rejects empty fragment (#)', () => {
    const html = '<a href="#">Back to top</a>';
    expect(extractLinks(html, true)).toEqual([]);
  });

  it('rejects mailto: links', () => {
    const html = '<a href="mailto:help@example.com">Email us</a>';
    expect(extractLinks(html, true)).toEqual([]);
    expect(extractLinks(html, false)).toEqual([]);
  });

  // ─── Valid links still pass alongside dangerous ones ──────────────────

  it('extracts valid links while rejecting dangerous ones', () => {
    const html = `
      <a href="javascript:void(0)">Bad</a>
      <a href="/campaigns/real-campaign">Good</a>
      <a href="data:evil">Bad</a>
      <a href="https://cancer.gov">Good</a>
      <a href="#">Bad</a>
    `;
    expect(extractLinks(html, true)).toEqual(['/campaigns/real-campaign']);
    expect(extractLinks(html, false)).toEqual(['https://cancer.gov']);
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  it('returns empty for HTML with no links', () => {
    expect(extractLinks('<p>No links here</p>', true)).toEqual([]);
  });

  it('returns empty for empty string', () => {
    expect(extractLinks('', true)).toEqual([]);
  });

  it('handles links with hyphens in path', () => {
    const html = '<a href="/blog/medical-fundraiser-guide">Guide</a>';
    expect(extractLinks(html, true)).toEqual(['/blog/medical-fundraiser-guide']);
  });

  it('handles multiple links of different types', () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://lastdonor.org/donate">Donate</a>
      <a href="https://stripe.com/docs">Stripe</a>
      <a href="https://who.int/health">WHO</a>
    `;
    const internal = extractLinks(html, true);
    const external = extractLinks(html, false);
    expect(internal).toContain('/about');
    expect(internal).toContain('https://lastdonor.org/donate');
    expect(external).toContain('https://stripe.com/docs');
    expect(external).toContain('https://who.int/health');
    expect(internal).not.toContain('https://stripe.com/docs');
  });
});
