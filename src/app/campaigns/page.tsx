import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or, desc, asc, sql, ilike, gte } from 'drizzle-orm';
import { CampaignGrid } from '@/components/campaign/CampaignGrid';
import { CategoryHeroSection } from '@/components/campaign/CategoryHeroSection';
import { CampaignFilters } from './filters';
import { getCategoryContent } from '@/lib/category-content';
import type { CampaignCategory } from '@/types';

export const metadata: Metadata = {
  title: 'Campaigns',
  description:
    'Browse verified fundraising campaigns for people who need help right now. Medical bills, emergencies, memorials, education, and more. Every campaign is verified by a real person.',
  openGraph: {
    title: 'Campaigns | LastDonor.org',
    description:
      'Verified fundraising campaigns for real people. No scams, no unverified stories. Every campaign verified by our editorial team.',
    images: [
      {
        url: '/api/v1/og/page?title=Verified+Campaigns&subtitle=Browse+real+fundraisers+verified+by+our+editorial+team.',
        width: 1200,
        height: 630,
        alt: 'Verified Campaigns on LastDonor.org',
      },
    ],
  },
};

const VALID_CATEGORIES: CampaignCategory[] = [
  'medical', 'memorial', 'emergency', 'charity', 'education', 'animal',
  'environment', 'business', 'community', 'competition', 'creative', 'event',
  'faith', 'family', 'sports', 'travel', 'volunteer', 'wishes',
  // Legacy values (kept for backward compatibility)
  'military', 'veterans', 'first-responders', 'disaster', 'essential-needs',
];

const VALID_SORTS = ['newest', 'most_funded', 'least_funded', 'closing_soon'] as const;
type SortOption = (typeof VALID_SORTS)[number];

interface PageProps {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    q?: string;
    location?: string;
    close_to_target?: string;
  }>;
}

const PAGE_SIZE = 12;

export default async function CampaignsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Validate category filter
  const categoryFilter = VALID_CATEGORIES.includes(params.category as CampaignCategory)
    ? (params.category as CampaignCategory)
    : null;

  const categoryContent = categoryFilter ? getCategoryContent(categoryFilter) : null;

  // Validate sort
  const sort: SortOption = VALID_SORTS.includes(params.sort as SortOption)
    ? (params.sort as SortOption)
    : 'most_funded';

  // Validate search query
  const searchQuery = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';

  // Validate location filter
  const locationFilter = typeof params.location === 'string' ? params.location.trim().slice(0, 100) : '';

  // Validate close-to-target toggle
  const closeToTarget = params.close_to_target === '1';

  // Build query conditions
  const statusFilter = or(
    eq(campaigns.status, 'active'),
    eq(campaigns.status, 'last_donor_zone'),
  )!;

  const filterParts = [statusFilter];

  if (categoryFilter) {
    filterParts.push(eq(campaigns.category, categoryFilter));
  }

  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    filterParts.push(
      or(
        ilike(campaigns.title, pattern),
        ilike(campaigns.subjectName, pattern),
        ilike(campaigns.location, pattern),
        ilike(campaigns.subjectHometown, pattern),
      )!,
    );
  }

  if (locationFilter) {
    const locPattern = `%${locationFilter}%`;
    filterParts.push(
      or(
        ilike(campaigns.location, locPattern),
        ilike(campaigns.subjectHometown, locPattern),
      )!,
    );
  }

  if (closeToTarget) {
    filterParts.push(
      gte(
        sql`(${campaigns.raisedAmount}::float / NULLIF(${campaigns.goalAmount}, 0))`,
        0.9,
      ),
    );
  }

  const conditions = and(...filterParts)!;

  // Build order
  const orderBy = (() => {
    switch (sort) {
      case 'most_funded':
        return desc(campaigns.raisedAmount);
      case 'least_funded':
        return asc(campaigns.raisedAmount);
      case 'closing_soon':
        return desc(sql`(${campaigns.raisedAmount}::float / NULLIF(${campaigns.goalAmount}, 0))`);
      case 'newest':
      default:
        return desc(campaigns.publishedAt);
    }
  })();

  // Fetch campaigns
  const results = await db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      heroImageUrl: campaigns.heroImageUrl,
      subjectName: campaigns.subjectName,
      subjectHometown: campaigns.subjectHometown,
      campaignOrganizer: campaigns.campaignOrganizer,
      category: campaigns.category,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
      donorCount: campaigns.donorCount,
      location: campaigns.location,
      status: campaigns.status,
      publishedAt: campaigns.publishedAt,
    })
    .from(campaigns)
    .where(conditions)
    .orderBy(orderBy)
    .limit(PAGE_SIZE + 1);

  const hasMore = results.length > PAGE_SIZE;
  const displayedCampaigns = hasMore ? results.slice(0, PAGE_SIZE) : results;
  const nextCursor = hasMore ? String(PAGE_SIZE) : null;

  return (
    <>
      {categoryContent && <CategoryHeroSection content={categoryContent} />}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {categoryContent ? (
          <h2 className="mb-6 font-display text-xl font-bold text-foreground sm:text-2xl">
            Browse {categoryContent.label.toLowerCase()} fundraisers
          </h2>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
              <h1 className="font-display text-2xl font-bold text-foreground">Verified Campaigns</h1>
              <Link
                href="/completed-campaigns"
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                View completed campaigns
              </Link>
            </div>

            {/* Filters & sort — search page only */}
            <CampaignFilters
              activeCategory={categoryFilter}
              activeSort={sort}
              activeCloseToTarget={closeToTarget}
              searchQuery={searchQuery}
              activeLocation={locationFilter}
            />
          </>
        )}

        {/* Campaign grid with client-side "Load More" */}
        <CampaignGrid
          key={`${categoryFilter ?? ''}-${sort}-${searchQuery}-${locationFilter}-${closeToTarget}`}
          initialCampaigns={displayedCampaigns}
          initialCursor={nextCursor}
          initialHasMore={hasMore}
          categoryFilter={categoryFilter}
          sort={sort}
          searchQuery={searchQuery}
          locationFilter={locationFilter}
          closeToTarget={closeToTarget}
        />
      </div>
    </>
  );
}
