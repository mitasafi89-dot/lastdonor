/**
 * Link Graph — manages internal linking between blog posts and site pages.
 * Ensures every new post gets contextual internal links and contributes
 * to the site's overall link structure.
 */

import { db } from '@/db';
import { blogPosts, campaigns, campaignCategoryEnum } from '@/db/schema';
import { eq, desc, and, ne } from 'drizzle-orm';

export interface LinkSuggestion {
  href: string;
  anchorText: string;
  context: string; // Why this link is relevant
}

/**
 * Get internal link suggestions for a blog post being generated.
 */
export async function getInternalLinkSuggestions(params: {
  causeCategory: string;
  primaryKeyword: string;
  excludeSlug?: string;
}): Promise<LinkSuggestion[]> {
  const links: LinkSuggestion[] = [];

  // 1. Link to a campaign in the same category
  const relatedCampaigns = await db
    .select({ slug: campaigns.slug, title: campaigns.title })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'active'),
        eq(campaigns.category, params.causeCategory as (typeof campaignCategoryEnum.enumValues)[number]),
      ),
    )
    .orderBy(desc(campaigns.publishedAt))
    .limit(2);

  for (const campaign of relatedCampaigns) {
    links.push({
      href: `/campaigns/${campaign.slug}`,
      anchorText: campaign.title,
      context: 'Related campaign in the same category',
    });
  }

  // 2. Link to another blog post (related topic)
  const relatedPosts = await db
    .select({ slug: blogPosts.slug, title: blogPosts.title })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.published, true),
        eq(blogPosts.causeCategory, params.causeCategory),
        params.excludeSlug
          ? ne(blogPosts.slug, params.excludeSlug)
          : undefined,
      ),
    )
    .orderBy(desc(blogPosts.publishedAt))
    .limit(2);

  for (const post of relatedPosts) {
    links.push({
      href: `/blog/${post.slug}`,
      anchorText: post.title,
      context: 'Related blog post',
    });
  }

  // 3. Static informational pages
  const staticPages: LinkSuggestion[] = [
    {
      href: '/how-it-works',
      anchorText: "learn how LastDonor.org's 0% fee model works",
      context: 'Explains platform value proposition',
    },
    {
      href: '/transparency',
      anchorText: 'see exactly where every dollar goes',
      context: 'Builds trust through transparency',
    },
    {
      href: '/about',
      anchorText: 'about LastDonor.org',
      context: 'About page for credibility',
    },
    {
      href: '/campaigns',
      anchorText: 'browse verified campaigns',
      context: 'Main campaigns directory',
    },
    {
      href: `/campaigns/category/${params.causeCategory}`,
      anchorText: `${params.causeCategory} campaigns`,
      context: 'Category-specific campaign listing',
    },
  ];

  // Add 2-3 static page links
  links.push(...staticPages.slice(0, 3));

  return links;
}
