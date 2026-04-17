import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { BlogEditor } from '@/components/admin/BlogEditor';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Blog Post - Admin - LastDonor.org',
  robots: { index: false },
};

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'editor')) {
    redirect('/admin');
  }

  const { id } = await params;
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);

  if (!post) {
    notFound();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground">Edit Blog Post</h1>
      <p className="mt-1 text-muted-foreground">Update &quot;{post.title}&quot;</p>
      <div className="mt-6">
        <BlogEditor
          mode="edit"
          postId={post.id}
          defaultValues={{
            title: post.title,
            slug: post.slug,
            bodyHtml: post.bodyHtml,
            excerpt: post.excerpt ?? '',
            coverImageUrl: post.coverImageUrl ?? '',
            authorName: post.authorName,
            authorBio: post.authorBio ?? '',
            category: post.category,
            published: post.published,
          }}
        />
      </div>
    </div>
  );
}
