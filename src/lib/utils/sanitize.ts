import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'strong', 'em', 'a', 'img',
  'blockquote', 'ul', 'ol', 'li', 'br',
  'section', 'nav', 'figure', 'figcaption',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
  'class', 'id', 'role', 'aria-label', 'loading',
];

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
