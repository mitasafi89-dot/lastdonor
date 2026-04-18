import sanitize from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'strong', 'em', 'a', 'img',
  'blockquote', 'ul', 'ol', 'li', 'br',
  'section', 'nav', 'figure', 'figcaption',
  'aside', 'span',
];

const ALLOWED_ATTR: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  '*': ['class', 'id', 'role', 'aria-label'],
};

// Strip data: and javascript: URIs from src/href (XSS vectors)
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

export function sanitizeHtml(dirty: string): string {
  return sanitize(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ALLOWED_SCHEMES,
    // Block data: and javascript: URIs
    allowedSchemesByTag: {
      img: ['http', 'https'],
      a: ['http', 'https', 'mailto'],
    },
  });
}
