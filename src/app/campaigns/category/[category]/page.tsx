import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import { CategoryHeroSection } from '@/components/campaign/CategoryHeroSection';
import { getCategoryContent, ALL_CATEGORY_SLUGS } from '@/lib/category-content';
import type { CampaignCategory } from '@/types';
import Link from 'next/link';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return ALL_CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const content = getCategoryContent(category);
  if (!content) return { title: 'Not Found' };

  return {
    title: content.seoTitle,
    description: content.metaDescription,
    openGraph: {
      title: `${content.seoTitle} | LastDonor.org`,
      description: content.metaDescription,
      images: [
        {
          url: `/api/v1/og/page?title=${encodeURIComponent(content.heading)}&subtitle=${encodeURIComponent(content.ogSubtitle)}`,
          width: 1200,
          height: 630,
          alt: content.heading,
        },
      ],
    },
  };
}

const PAGE_SIZE = 12;

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  const content = getCategoryContent(category);
  if (!content) notFound();

  const categorySlug = content.slug as CampaignCategory;

  const results = await db
    .select({
      slug: campaigns.slug,
      title: campaigns.title,
      heroImageUrl: campaigns.heroImageUrl,
      subjectName: campaigns.subjectName,
      campaignOrganizer: campaigns.campaignOrganizer,
      category: campaigns.category,
      location: campaigns.location,
      subjectHometown: campaigns.subjectHometown,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.category, categorySlug),
        or(
          eq(campaigns.status, 'active'),
          eq(campaigns.status, 'last_donor_zone'),
        ),
      ),
    )
    .orderBy(desc(campaigns.raisedAmount))
    .limit(PAGE_SIZE);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: content.heading,
    description: content.jsonLdDescription,
    url: `https://lastdonor.org/campaigns/category/${content.slug}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'LastDonor.org',
      url: 'https://lastdonor.org',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CategoryHeroSection content={content} />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs />

        <h2 className="mt-6 mb-6 font-display text-xl font-bold text-foreground sm:text-2xl">
          Browse {content.label.toLowerCase()} fundraisers
        </h2>

        {results.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((campaign) => (
            <CampaignCard
              key={campaign.slug}
              slug={campaign.slug}
              title={campaign.title}
              heroImageUrl={campaign.heroImageUrl}
              subjectName={campaign.subjectName}
              category={campaign.category}
              location={campaign.location || campaign.subjectHometown}
              raisedAmount={campaign.raisedAmount}
              goalAmount={campaign.goalAmount}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-lg text-muted-foreground">
            No active {content.label.toLowerCase()} campaigns right now.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check back soon or{' '}
            <Link href="/share-your-story" className="text-primary underline hover:text-primary/80">
              start one yourself
            </Link>.
          </p>
        </div>
      )}

      {results.length >= PAGE_SIZE && (
        <div className="mt-8 text-center">
          <Link
            href={`/campaigns?category=${content.slug}`}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            View all {content.label.toLowerCase()} campaigns
          </Link>
        </div>
      )}
      </div>
    </>
  );
}
