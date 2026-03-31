import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { campaigns, blogPosts } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { ALL_CATEGORY_SLUGS } from '@/lib/category-content';

const BASE_URL = 'https://lastdonor.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/how-it-works`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/transparency`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/campaigns`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/blog`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/last-donor-wall`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/donate`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/editorial-standards`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/share-your-story`, changeFrequency: 'monthly', priority: 0.4 },
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
    .select({ slug: blogPosts.slug, publishedAt: blogPosts.publishedAt })
    .from(blogPosts)
    .where(eq(blogPosts.published, true));

  const blogPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: p.publishedAt ?? undefined,
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
