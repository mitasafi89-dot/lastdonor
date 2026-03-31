import { sanitizeHtml } from '@/lib/utils/sanitize';

interface ArticleRendererProps {
  html: string;
}

export function ArticleRenderer({ html }: ArticleRendererProps) {
  const clean = sanitizeHtml(html);

  return (
    <div
      className="blog-article prose prose-lg max-w-none dark:prose-invert prose-headings:font-display prose-headings:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:text-2xl sm:prose-h2:text-3xl prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-xl prose-h3:italic prose-p:mb-5 prose-p:leading-relaxed prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:text-primary/80 prose-img:my-6 prose-img:rounded-lg prose-img:shadow-md prose-blockquote:my-6 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/30 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:text-muted-foreground prose-blockquote:italic prose-ul:my-4 prose-ol:my-4 prose-li:my-1"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
