import { sanitizeHtml } from '@/lib/utils/sanitize';
import { describe, it, expect } from 'vitest';

/**
 * Canary Payload Tests ("Salt Protocol")
 *
 * These payloads are deliberately malicious. Every one must be neutralized
 * by sanitizeHtml(). If any payload survives intact, the sanitizer is broken.
 */
const CANARY_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<a href="javascript:alert(1)">click</a>',
  '<iframe src="data:text/html,<script>alert(1)</script>">',
  '"><img src=x onerror=prompt(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
  '<body onload=alert(1)>',
  '<a href="data:text/html,<script>alert(1)</script>">click</a>',
  '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
  '<math><mtext><table><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1) src=1>">',
  '<div style="background:url(javascript:alert(1))">',
  '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">encoded</a>',
  '<object data="data:text/html,<script>alert(1)</script>">',
  '<embed src="data:text/html,<script>alert(1)</script>">',
  '<form action="javascript:alert(1)"><input type=submit>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<marquee onstart=alert(1)>',
  '<video><source onerror=alert(1)>',
];

const DANGEROUS_PATTERNS = [
  /<script/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /ontoggle\s*=/i,
  /onfocus\s*=/i,
  /onstart\s*=/i,
  /javascript:/i,
  /data:text\/html/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /<form\s/i,
  /<meta\s/i,
];

describe('Security: Canary Payload Sanitization', () => {
  for (const payload of CANARY_PAYLOADS) {
    it(`neutralizes: ${payload.slice(0, 60)}${payload.length > 60 ? '...' : ''}`, () => {
      const sanitized = sanitizeHtml(payload);

      for (const pattern of DANGEROUS_PATTERNS) {
        expect(sanitized).not.toMatch(pattern);
      }
    });
  }

  it('preserves legitimate medical/financial fundraising content', () => {
    const legitimate =
      '<p>Patient requires <strong>Rituximab</strong> therapy. ' +
      'Cost: $45,000 per cycle. ICD-10 code: C83.3. ' +
      'Treatment at <em>Memorial Sloan Kettering</em>.</p>' +
      '<ul><li>Phase 1: Induction (6 cycles)</li>' +
      '<li>Phase 2: Maintenance</li></ul>';
    const sanitized = sanitizeHtml(legitimate);

    expect(sanitized).toContain('Rituximab');
    expect(sanitized).toContain('$45,000');
    expect(sanitized).toContain('C83.3');
    expect(sanitized).toContain('Memorial Sloan Kettering');
    expect(sanitized).toContain('<strong>');
    expect(sanitized).toContain('<em>');
    expect(sanitized).toContain('<ul>');
    expect(sanitized).toContain('<li>');
  });

  it('preserves safe links but strips javascript: URIs', () => {
    const mixed =
      '<p><a href="https://hospital.org/donate">Donate here</a> ' +
      '<a href="javascript:alert(1)">evil</a></p>';
    const sanitized = sanitizeHtml(mixed);

    expect(sanitized).toContain('href="https://hospital.org/donate"');
    expect(sanitized).not.toContain('javascript:');
  });

  it('returns empty string for null-like inputs', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});
