import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { campaigns, donations, blogPosts } from '@/db/schema';
import { eq, or, desc, sql } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import { HeroSection } from '@/components/homepage/HeroSection';
import { TrustBar } from '@/components/homepage/TrustBar';
import { HowItWorks } from '@/components/homepage/HowItWorks';
import { CategoryShowcase } from '@/components/homepage/CategoryShowcase';
import { ImpactCounter } from '@/components/homepage/ImpactCounter';
import { WhereYourMoneyGoes } from '@/components/homepage/WhereYourMoneyGoes';
import { TrustBanner } from '@/components/homepage/TrustBanner';
import { Testimonials } from '@/components/homepage/Testimonials';
import { Newsletter } from '@/components/homepage/Newsletter';
import { CampaignCard } from '@/components/campaign/CampaignCard';

import { AnimateOnScroll } from '@/components/AnimateOnScroll';

export const metadata: Metadata = {
  title: 'LastDonor.org - Donate to Real People in Need | 0% Platform Fees',
  description:
    'Crowdfunding that actually works for you. No hidden tips, no surprise fees, no AI chatbots. Every campaign is verified. Every dollar is tracked. See exactly where your money goes.',
  openGraph: {
    title: 'LastDonor.org - Donate to Real People in Need',
    description:
      'No hidden tips. No surprise fees. Every campaign is verified, every dollar is tracked. Crowdfunding built on trust.',
    url: 'https://lastdonor.org',
    images: [
      {
        url: '/api/v1/og/page?title=Donate+to+Real+People+in+Need&subtitle=0%25+fees.+Every+campaign+verified.+Every+dollar+tracked.',
        width: 1200,
        height: 630,
        alt: 'LastDonor.org - Donate to Real People in Need',
      },
    ],
  },
};

export const dynamic = 'force-dynamic';

async function getHomepageData() {
  const [featuredCampaigns, activeCampaigns, stats, latestPosts, completedCount, supportedCount] =
    await Promise.all([
      // Featured campaign: most recently published active
      db
        .select({
          slug: campaigns.slug,
          title: campaigns.title,
          heroImageUrl: campaigns.heroImageUrl,
          subjectName: campaigns.subjectName,
          campaignOrganizer: sql<string | undefined>`${campaigns.campaignOrganizer}::text`,
          category: campaigns.category,
          raisedAmount: campaigns.raisedAmount,
          goalAmount: campaigns.goalAmount,
        })
        .from(campaigns)
        .where(
          or(
            eq(campaigns.status, 'active'),
            eq(campaigns.status, 'last_donor_zone'),
          ),
        )
        .orderBy(desc(campaigns.publishedAt))
        .limit(1),

      // Active campaigns for grid (top 6 by total donations)
      db
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
          donorCount: campaigns.donorCount,
          verificationStatus: campaigns.verificationStatus,
        })
        .from(campaigns)
        .where(
          or(
            eq(campaigns.status, 'active'),
            eq(campaigns.status, 'last_donor_zone'),
          ),
        )
        .orderBy(desc(campaigns.raisedAmount))
        .limit(6),

      // Aggregate platform stats
      db
        .select({
          totalRaised: sql<number>`COALESCE(SUM(CASE WHEN ${donations.source} = 'real' AND ${donations.refunded} = false THEN ${donations.amount} ELSE 0 END), 0)`,
          totalDonors: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${donations.source} = 'real' THEN ${donations.donorEmail} END), 0)`,
        })
        .from(donations),

      // Latest published blog posts
      db
        .select({
          slug: blogPosts.slug,
          title: blogPosts.title,
          excerpt: blogPosts.excerpt,
          coverImageUrl: blogPosts.coverImageUrl,
          authorName: blogPosts.authorName,
          category: blogPosts.category,
          publishedAt: blogPosts.publishedAt,
        })
        .from(blogPosts)
        .where(eq(blogPosts.published, true))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(3),

      // Completed campaign count
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(campaigns)
        .where(
          or(
            eq(campaigns.status, 'completed'),
            eq(campaigns.status, 'archived'),
          ),
        ),

      // Unique people supported
      db
        .select({
          count: sql<number>`COUNT(DISTINCT ${campaigns.subjectName})`,
        })
        .from(campaigns)
        .where(eq(campaigns.status, 'completed')),
    ]);

  return {
    featuredCampaign: featuredCampaigns[0] ?? null,
    activeCampaigns,
    totalRaised: Number(stats[0]?.totalRaised ?? 0),
    totalDonors: Number(stats[0]?.totalDonors ?? 0),
    campaignsCompleted: Number(completedCount[0]?.count ?? 0),
    peopleSupported: Number(supportedCount[0]?.count ?? 0),
    latestPosts,
  };
}

const getCachedHomepageData = unstable_cache(
  getHomepageData,
  ['homepage-data'],
  { revalidate: 300 },
);

export default async function Home() {
  const data = await getCachedHomepageData();

  return (
    <>
      <HeroSection />
      <TrustBar />

      {/* AI/SEO Answer Block — structured definitions for AI snippet extraction */}
      <section
        id="ai-answer"
        data-speakable="true"
        className="bg-background py-10 sm:py-12"
        aria-label="Platform overview"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-base font-medium leading-relaxed text-foreground">
            LastDonor.org is a 501(c)(3) nonprofit crowdfunding platform that charges 0%
            platform fees, requires editorial review of every campaign before publication,
            and provides milestone-verified fund releases — so every dollar is tracked from
            your card to the recipient&apos;s bank account.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm leading-relaxed">
            <div>
              <dt className="font-semibold text-foreground">Platform fee</dt>
              <dd className="mt-0.5 text-muted-foreground">
                0% — only Stripe&apos;s standard 2.9% + $0.30 processing fee applies.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Campaign verification</dt>
              <dd className="mt-0.5 text-muted-foreground">
                Named editor checks documents and cites sources before any campaign goes live.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Fund release</dt>
              <dd className="mt-0.5 text-muted-foreground">
                Released at verified milestones — no 5-7 day holds.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Human support</dt>
              <dd className="mt-0.5 text-muted-foreground">
                Real person responds within 1 business day. No AI chatbot routing.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Active Campaigns */}
      {data.activeCampaigns.length > 0 && (
        <section className="bg-surface-teal py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimateOnScroll>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Verified Campaigns Raising Money Right Now
              </h2>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                Every campaign below has been reviewed by a real person.
                Give with confidence knowing your donation is tracked from start to finish.
              </p>
            </AnimateOnScroll>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.activeCampaigns.map((c) => (
                <CampaignCard
                  key={c.slug}
                  slug={c.slug}
                  title={c.title}
                  heroImageUrl={c.heroImageUrl}
                  subjectName={c.subjectName}
                  category={c.category}
                  location={c.location || c.subjectHometown || undefined}
                  raisedAmount={c.raisedAmount}
                  goalAmount={c.goalAmount}
                  donorCount={c.donorCount}
                />
              ))}
            </div>
            <AnimateOnScroll className="mt-8">
              <Link
                href="/campaigns"
                className="btn-press inline-flex rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Browse verified campaigns raising money now
              </Link>
            </AnimateOnScroll>
          </div>
        </section>
      )}

      <HowItWorks />
      <ImpactCounter
        totalRaised={data.totalRaised}
        totalDonors={data.totalDonors}
        campaignsCompleted={data.campaignsCompleted}
        peopleSupported={data.peopleSupported}
      />
      <WhereYourMoneyGoes />
      <Testimonials />
      <CategoryShowcase />
      <TrustBanner />

      {/* Blog Preview */}
      {data.latestPosts.length > 0 && (
        <section className="bg-surface-sage py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimateOnScroll>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Impact Stories from Real Campaigns
              </h2>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                Updates, results, and the real stories behind the people you help.
              </p>
            </AnimateOnScroll>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.latestPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-card card-hover-lift"
                >
                  {post.coverImageUrl && (
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={post.coverImageUrl}
                        alt={`Illustration for a ${post.category ?? 'fundraising'} article on LastDonor.org — ${post.excerpt ? post.excerpt.slice(0, 80) : post.title}`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    {post.category && (
                      <span className="mb-2 inline-block text-xs font-medium capitalize text-primary">
                        {post.category}
                      </span>
                    )}
                    <h3 className="line-clamp-2 font-display text-lg font-semibold text-card-foreground">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {post.excerpt}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {post.authorName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <AnimateOnScroll className="mt-8 text-center">
              <Link
                href="/blog"
                className="btn-press inline-flex rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
              >
                Read more stories
              </Link>
            </AnimateOnScroll>
          </div>
        </section>
      )}

      <Newsletter />
    </>
  );
}
