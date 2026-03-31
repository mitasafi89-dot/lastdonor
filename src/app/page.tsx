import type { Metadata } from 'next';
import { db } from '@/db';
import { campaigns, donations, blogPosts } from '@/db/schema';
import { eq, and, or, desc, sql, ne } from 'drizzle-orm';
import Link from 'next/link';
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

export const metadata: Metadata = {
  title: 'LastDonor.org — Donate to Real People in Need | 0% Platform Fees',
  description:
    'Crowdfunding that actually works for you. No hidden tips, no surprise fees, no AI chatbots. Every campaign is verified. Every dollar is tracked. See exactly where your money goes.',
  openGraph: {
    title: 'LastDonor.org — Donate to Real People in Need',
    description:
      'No hidden tips. No surprise fees. Every campaign is verified, every dollar is tracked. Crowdfunding built on trust.',
    url: 'https://lastdonor.org',
    images: [
      {
        url: '/api/v1/og/page?title=Donate+to+Real+People+in+Need&subtitle=0%25+fees.+Every+campaign+verified.+Every+dollar+tracked.',
        width: 1200,
        height: 630,
        alt: 'LastDonor.org — Donate to Real People in Need',
      },
    ],
  },
};

export const revalidate = 300; // ISR: revalidate every 5 minutes

async function getHomepageData() {
  const [featuredCampaigns, activeCampaigns, stats, latestPosts] =
    await Promise.all([
      // Featured campaign: most recently published active
      db
        .select({
          slug: campaigns.slug,
          title: campaigns.title,
          heroImageUrl: campaigns.heroImageUrl,
          subjectName: campaigns.subjectName,
          campaignOrganizer: campaigns.campaignOrganizer,
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
    ]);

  const completedCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(campaigns)
    .where(
      or(
        eq(campaigns.status, 'completed'),
        eq(campaigns.status, 'archived'),
      ),
    );

  const supportedCount = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${campaigns.subjectName})`,
    })
    .from(campaigns)
    .where(eq(campaigns.status, 'completed'));

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

export default async function Home() {
  const data = await getHomepageData();

  return (
    <>
      <HeroSection featuredCampaign={data.featuredCampaign} />
      <TrustBar totalDonors={data.totalDonors} />
      <HowItWorks />

      {/* Active Campaigns */}
      {data.activeCampaigns.length > 0 && (
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Verified Campaigns Raising Money Right Now
              </h2>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                Every campaign below has been reviewed by a real person.
                Give with confidence knowing your donation is tracked from start to finish.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.activeCampaigns.map((c) => (
                <CampaignCard
                  key={c.slug}
                  slug={c.slug}
                  title={c.title}
                  heroImageUrl={c.heroImageUrl}
                  subjectName={c.subjectName}
                  category={c.category}
                  location={c.location || c.subjectHometown}
                  raisedAmount={c.raisedAmount}
                  goalAmount={c.goalAmount}
                  donorCount={c.donorCount}
                />
              ))}
            </div>
            <div className="mt-8">
              <Link
                href="/campaigns"
                className="inline-flex rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                See all fundraisers
              </Link>
            </div>
          </div>
        </section>
      )}

      <ImpactCounter
        totalRaised={data.totalRaised}
        totalDonors={data.totalDonors}
        campaignsCompleted={data.campaignsCompleted}
        peopleSupported={data.peopleSupported}
      />
      <WhereYourMoneyGoes />
      <CategoryShowcase />
      <Testimonials />
      <TrustBanner />

      {/* Blog Preview */}
      {data.latestPosts.length > 0 && (
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Impact Stories from Real Campaigns
              </h2>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                Updates, results, and the real stories behind the people you help.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.latestPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  {post.coverImageUrl && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={post.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
            <div className="mt-8 text-center">
              <Link
                href="/blog"
                className="inline-flex rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Read more stories
              </Link>
            </div>
          </div>
        </section>
      )}

      <Newsletter />
    </>
  );
}
