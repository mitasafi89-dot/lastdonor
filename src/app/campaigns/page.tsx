import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or, desc, asc, sql, ilike, gte } from 'drizzle-orm';
import { CampaignGrid } from '@/components/campaign/CampaignGrid';
import { CategoryHeroSection } from '@/components/campaign/CategoryHeroSection';
import { CampaignFilters } from './filters';
import { getCategoryContent } from '@/lib/category-content';
import { seoKeywords } from '@/lib/seo/keywords';
import type { CampaignCategory } from '@/types';

export const metadata: Metadata = {
  title: 'Browse Reviewed Medical & Emergency Crowdfunding Campaigns | LastDonor',
  description:
    'Browse reviewed crowdfunding campaigns for medical fundraising, emergency relief, disaster fundraising, medical bills, veteran families, first responders, education, and family emergency fundraising. Every campaign is reviewed before publication. 0% platform fees.',
  keywords: seoKeywords('campaigns', 'medical', 'emergency', 'disaster', 'memorial', 'family', 'nonprofit', 'trust'),
  alternates: { canonical: 'https://lastdonor.org/campaigns' },
  openGraph: {
    title: 'Browse Reviewed Medical & Emergency Crowdfunding Campaigns | LastDonor',
    description:
      'Find reviewed medical fundraising, emergency relief, and disaster relief campaigns with visible progress and 0% platform fees.',
    url: 'https://lastdonor.org/campaigns',
    images: [
      {
        url: '/api/v1/og/page?title=Reviewed+Campaigns&subtitle=Browse+fundraisers+reviewed+before+publication.',
        width: 1200,
        height: 630,
        alt: 'Reviewed Crowdfunding Campaigns on LastDonor',
      },
    ],
  },
};

export const revalidate = 300; // ISR: refresh every 5 minutes

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

const faqs = [
  {
    question: 'What fundraisers can I browse on LastDonor?',
    answer:
      'You can browse reviewed medical fundraisers, emergency fundraisers, memorial funds, disaster relief fundraisers, family emergency campaigns, veteran fundraisers, education fundraisers, animal fundraisers, and community fundraisers.',
  },
  {
    question: 'Are campaigns reviewed before they appear here?',
    answer:
      'Yes. Campaigns listed on this page are reviewed before publication so donors can understand the need, the fundraising goal, and the available supporting context.',
  },
  {
    question: 'Can I search by cause or location?',
    answer:
      'Yes. Use the filters to search by fundraiser category, location, campaign status, or keywords such as medical bills, funeral expenses, house fire, tuition, pet surgery, or veteran support.',
  },
  {
    question: 'What does close to target mean?',
    answer:
      'Close-to-target fundraisers are campaigns that are near their goal. They can be useful for donors who want to help complete a campaign and become the Last Donor.',
  },
];

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

  // Build order - always include a tiebreaker (id) so offset pagination is deterministic
  const primaryOrder = (() => {
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

  // Fetch campaigns + counts in parallel. Counts drive the social-proof header.
  const [results, activeCountRow, completedCountRow] = await Promise.all([
    db
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
      .orderBy(primaryOrder, asc(campaigns.id))
      .limit(PAGE_SIZE + 1),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(campaigns)
      .where(
        or(eq(campaigns.status, 'active'), eq(campaigns.status, 'last_donor_zone')),
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(campaigns)
      .where(or(eq(campaigns.status, 'completed'), eq(campaigns.status, 'archived'))),
  ]);

  const activeCount = Number(activeCountRow[0]?.count ?? 0);
  const completedCount = Number(completedCountRow[0]?.count ?? 0);

  const hasMore = results.length > PAGE_SIZE;
  const displayedCampaigns = hasMore ? results.slice(0, PAGE_SIZE) : results;
  const nextCursor = hasMore ? String(PAGE_SIZE) : null;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {categoryContent && <CategoryHeroSection content={categoryContent} />}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {categoryContent ? (
          <h2 className="mb-6 font-display text-xl font-bold text-foreground sm:text-2xl">
            Browse {categoryContent.label.toLowerCase()} fundraisers
          </h2>
        ) : (
          <>
            {/* Header: emotional headline + social-proof count + trust anchor.
                Psychology: Anchoring (concrete number), Authority (reviewed), Zero-Knowledge Proof. */}
            <header className="mb-6">
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Reviewed Fundraisers Raising Money Right Now
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <ShieldCheckIcon className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                <span>
                  <span className="font-semibold text-foreground tabular-nums">{activeCount.toLocaleString('en-US')}</span>{' '}active {activeCount === 1 ? 'campaign' : 'campaigns'}
                </span>
                <span aria-hidden="true" className="text-border">·</span>
                <span>Each one reviewed before going live</span>
              </p>
            </header>

            {/* Status tabs: Gestalt Enclosure + Similarity. Active-first ordering (Serial Position). */}
            <div
              role="tablist"
              aria-label="Campaign status"
              className="mb-6 inline-flex rounded-full border border-border bg-muted/50 p-1 text-sm font-semibold"
            >
              <span
                role="tab"
                aria-selected="true"
                className="rounded-full bg-background px-4 py-1.5 text-foreground shadow-[--shadow-elevation-1]"
              >
                Active
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {activeCount.toLocaleString('en-US')}
                </span>
              </span>
              <Link
                role="tab"
                aria-selected="false"
                href="/completed-campaigns"
                className="rounded-full px-4 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Completed
                <span className="ml-1.5 tabular-nums">
                  {completedCount.toLocaleString('en-US')}
                </span>
              </Link>
            </div>

            {/* Filters & sort - search page only */}
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

        <section className="mt-12 border-t border-border pt-10" aria-labelledby="campaigns-faq">
          <h2 id="campaigns-faq" className="font-display text-2xl font-bold text-foreground">
            Fundraiser Search FAQ
          </h2>
          <dl className="mt-5 grid gap-5 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="font-semibold text-foreground">{faq.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
