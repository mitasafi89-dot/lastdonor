import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '@/lib/utils/sanitize';

describe('sanitizeHtml', () => {
  it('preserves allowed tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(input)).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('preserves em tags', () => {
    const input = '<em>emphasized text</em>';
    expect(sanitizeHtml(input)).toBe('<em>emphasized text</em>');
  });

  it('preserves anchor tags with allowed attributes', () => {
    const input = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
    expect(sanitizeHtml(input)).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener">Link</a>',
    );
  });

  it('preserves img tags with allowed attributes', () => {
    const input = '<img src="https://example.com/img.webp" alt="Photo" width="600" height="400">';
    const result = sanitizeHtml(input);
    expect(result).toContain('src="https://example.com/img.webp"');
    expect(result).toContain('alt="Photo"');
  });

  it('preserves lists', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(sanitizeHtml(input)).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('preserves blockquotes', () => {
    const input = '<blockquote>A wise quote</blockquote>';
    expect(sanitizeHtml(input)).toBe('<blockquote>A wise quote</blockquote>');
  });

  it('strips script tags', () => {
    const input = '<p>Safe</p><script>alert("xss")</script>';
    expect(sanitizeHtml(input)).not.toContain('<script>');
    expect(sanitizeHtml(input)).not.toContain('alert');
  });

  it('strips event handler attributes', () => {
    const input = '<p onclick="alert(1)" onmouseover="hack()">Text</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
  });

  it('strips style attributes', () => {
    const input = '<p style="color:red">Styled</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('style=');
  });

  it('strips disallowed tags like iframe', () => {
    const input = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('<p>Safe</p>');
  });

  it('strips disallowed tags like form', () => {
    const input = '<form action="/steal"><input type="text"></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  it('keeps safe attributes but strips unsafe ones from allowed tags', () => {
    const input = '<a href="https://safe.com" class="link" id="cta" onclick="hack()">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://safe.com"');
    expect(result).toContain('class="link"');
    expect(result).toContain('id="cta"');
    expect(result).not.toContain('onclick=');
  });

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('strips javascript: protocol in href', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });
});
