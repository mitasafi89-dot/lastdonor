import { BlogEditor } from '@/components/admin/BlogEditor';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Blog Post — Admin — LastDonor.org',
  robots: { index: false },
};

export default function NewBlogPostPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground">New Blog Post</h1>
      <p className="mt-1 text-muted-foreground">Create a new article for the blog.</p>
      <div className="mt-6">
        <BlogEditor mode="create" />
      </div>
    </div>
  );
}
