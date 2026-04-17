import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'strong', 'em', 'a', 'img',
  'blockquote', 'ul', 'ol', 'li', 'br',
  'section', 'nav', 'figure', 'figcaption',
  'aside', 'span',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
  'class', 'id', 'role', 'aria-label', 'loading',
];

// Strip data: URIs from src/href (SVG-in-data-URI XSS vector)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttribute('src')) {
    const src = node.getAttribute('src') ?? '';
    if (/^\s*data:/i.test(src)) {
      node.removeAttribute('src');
    }
  }
  if (node.hasAttribute('href')) {
    const href = node.getAttribute('href') ?? '';
    if (/^\s*data:/i.test(href)) {
      node.removeAttribute('href');
    }
  }
});

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
