import { sanitizeHtml } from '@/lib/utils/sanitize';

interface ArticleRendererProps {
  html: string;
}

export function ArticleRenderer({ html }: ArticleRendererProps) {
  const clean = sanitizeHtml(html);

  return (
    <div
      className="blog-article"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
