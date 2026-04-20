import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { campaigns, blogPosts } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { ALL_CATEGORY_SLUGS } from '@/lib/category-content';

const BASE_URL = 'https://lastdonor.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    // lastModified must be a deterministic date representing the last intentional
    // content change, not new Date(). A perpetually-changing lastmod causes Google
    // to treat the homepage as constantly mutating, wasting crawl budget and
    // creating a temporal contradiction when content is actually stable under ISR.
    // Update this value whenever the homepage copy, H1, or schema is intentionally changed.
    { url: BASE_URL, lastModified: new Date('2026-04-21'), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: new Date('2026-04-21'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/how-it-works`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/transparency`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/campaigns`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/blog`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/last-donor-wall`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/donate`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/share-your-story`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/editorial-standards`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Category landing pages
  const categoryPages: MetadataRoute.Sitemap = ALL_CATEGORY_SLUGS.map((slug) => ({
    url: `${BASE_URL}/campaigns/category/${slug}`,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Active campaigns
  const activeCampaigns = await db
    .select({ slug: campaigns.slug, updatedAt: campaigns.updatedAt })
    .from(campaigns)
    .where(inArray(campaigns.status, ['active', 'last_donor_zone']));

  const activeCampaignPages: MetadataRoute.Sitemap = activeCampaigns.map((c) => ({
    url: `${BASE_URL}/campaigns/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Completed campaigns
  const completedCampaigns = await db
    .select({ slug: campaigns.slug, updatedAt: campaigns.updatedAt })
    .from(campaigns)
    .where(eq(campaigns.status, 'completed'));

  const completedCampaignPages: MetadataRoute.Sitemap = completedCampaigns.map((c) => ({
    url: `${BASE_URL}/campaigns/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.3,
  }));

  // Blog posts
  const posts = await db
    .select({ slug: blogPosts.slug, publishedAt: blogPosts.publishedAt, updatedAt: blogPosts.updatedAt })
    .from(blogPosts)
    .where(eq(blogPosts.published, true));

  const blogPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    // Use updatedAt so edited posts receive re-crawl priority signals.
    // publishedAt alone reports the original publish date forever, causing
    // Google to treat edited content as never updated.
    lastModified: p.updatedAt ?? p.publishedAt ?? undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...categoryPages,
    ...activeCampaignPages,
    ...completedCampaignPages,
    ...blogPages,
  ];
}
