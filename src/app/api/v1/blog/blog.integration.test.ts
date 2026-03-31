/**
 * Blog Integration Tests
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { clearDatabase } from '../../../../../test/helpers';

describe('Blog Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it('returns only published blog posts', async () => {
    await db.insert(schema.blogPosts).values({
      title: 'Published Post',
      slug: 'published-post',
      bodyHtml: '<p>Published content</p>',
      authorName: 'Editor',
      category: 'news',
      published: true,
      publishedAt: new Date(),
    });

    await db.insert(schema.blogPosts).values({
      title: 'Draft Post',
      slug: 'draft-post',
      bodyHtml: '<p>Draft content</p>',
      authorName: 'Editor',
      category: 'news',
      published: false,
    });

    const publishedPosts = await db
      .select()
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.published, true));

    expect(publishedPosts).toHaveLength(1);
    expect(publishedPosts[0].slug).toBe('published-post');
  });

  it('finds a post by slug when published', async () => {
    await db.insert(schema.blogPosts).values({
      title: 'Find Me',
      slug: 'find-me',
      bodyHtml: '<p>Content here</p>',
      authorName: 'Editor',
      category: 'impact_report',
      published: true,
      publishedAt: new Date(),
    });

    const [post] = await db
      .select()
      .from(schema.blogPosts)
      .where(
        and(
          eq(schema.blogPosts.slug, 'find-me'),
          eq(schema.blogPosts.published, true),
        ),
      )
      .limit(1);

    expect(post).toBeDefined();
    expect(post.title).toBe('Find Me');
  });

  it('does not find unpublished post by slug', async () => {
    await db.insert(schema.blogPosts).values({
      title: 'Hidden Post',
      slug: 'hidden-post',
      bodyHtml: '<p>Secret content</p>',
      authorName: 'Editor',
      category: 'news',
      published: false,
    });

    const found = await db
      .select()
      .from(schema.blogPosts)
      .where(
        and(
          eq(schema.blogPosts.slug, 'hidden-post'),
          eq(schema.blogPosts.published, true),
        ),
      )
      .limit(1);

    expect(found).toHaveLength(0);
  });
});
