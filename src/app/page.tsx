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
import { HomepageFAQ } from '@/components/homepage/HomepageFAQ';
import { CampaignCard } from '@/components/campaign/CampaignCard';

import { AnimateOnScroll } from '@/components/AnimateOnScroll';

const BASE_URL = 'https://lastdonor.org';

export const metadata: Metadata = {
  title: 'Online Fundraising with 0% Fees | LastDonor.org',
  description:
    'LastDonor is a verified crowdfunding platform with 0% platform fees. Donate to medical bills, emergencies, veterans, and families in need. Every campaign is human-reviewed. Every dollar tracked.',
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: 'Online Fundraising with 0% Fees | LastDonor.org',
    description:
      '0% platform fees. Every campaign human-verified. Every dollar tracked from your card to the person in need. Crowdfunding built on transparency.',
    url: BASE_URL,
    images: [
      {
        url: '/api/v1/og/page?title=Online+Fundraising+with+0%25+Fees&subtitle=Every+campaign+verified.+Every+dollar+tracked.',
        width: 1200,
        height: 630,
        alt: 'LastDonor.org - Online Fundraising Platform with 0% Fees',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Online Fundraising with 0% Fees | LastDonor.org',
    description:
      '0% platform fees. Every campaign human-verified. Donate to verified campaigns for medical bills, emergencies, veterans, and families.',
  },
};

// Revalidate homepage data every 5 minutes via unstable_cache in getCachedHomepageData.
// Do NOT add force-dynamic here; that would bypass Vercel Edge Cache.
export const revalidate = 300;

// Single @graph merges WebPage + FAQPage so the speakable reference and
// isPartOf/@id cross-links to the layout.tsx Organization + WebSite graph nodes
// resolve correctly inside Google's JSON-LD parser.
const homeSchemaGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/#webpage`,
      url: BASE_URL,
      name: 'Online Fundraising with 0% Fees | LastDonor.org',
      description:
        'LastDonor.org is a 501(c)(3) verified crowdfunding platform that charges 0% platform fees, requires human editorial review of every campaign before publication, and provides verified photo-and-receipt impact updates — serving medical, emergency, veteran, and family fundraising across the United States.',
      isPartOf: { '@id': `${BASE_URL}/#website` },
      about: { '@id': `${BASE_URL}/#organization` },
      // SpeakableSpecification tells Google Assistant, Siri (Applebot), and AI
      // Overview generation which content segments to synthesize as spoken or
      // snapshot answers. Without this, the system degrades to meta description
      // extraction — a lower-confidence signal.
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', '.hero-summary'],
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Does LastDonor charge platform fees?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. LastDonor charges 0% platform fees. The only deduction from donations is the standard payment processing fee (approximately 2.9% + 30 cents), which goes directly to our payment processor, Stripe. Every cent of your platform donation reaches the person in need.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does LastDonor verify campaigns?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Every campaign on LastDonor is reviewed by a real human before it goes live. We require documentation such as medical records, bills, official letters, or photos to verify the situation is genuine. Campaigns that do not meet our verification standards are rejected and listed publicly.',
          },
        },
        {
          '@type': 'Question',
          name: 'Where does my donation money go?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'LastDonor charges 0% platform fees. At least 90% of every donation reaches the verified individual or family directly. The only deduction is Stripe\u2019s standard payment processing fee (2.9% + $0.30 per transaction), which goes entirely to Stripe. There are no hidden tips, no platform cuts, and no surprise charges. Donors receive verified receipts and impact updates with photos showing exactly how funds were used.',
          },
        },
        {
          '@type': 'Question',
          name: 'What kinds of campaigns can I fund on LastDonor?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'LastDonor supports verified fundraising campaigns for medical bills, emergency situations, memorial funds, military and veteran families, first responders, education, disaster relief, community needs, and family crises. Every campaign category is browsable on our campaigns page.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is LastDonor a legitimate nonprofit?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. LastDonor.org is a registered 501(c)(3) nonprofit organization. All campaigns are publicly listed, including rejected campaigns, so donors can see our verification standards in action. Live platform statistics are available on our Transparency page.',
          },
        },
        {
          '@type': 'Question',
          name: 'How is LastDonor different from GoFundMe?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "LastDonor charges 0% platform fees and has no tip mechanism at checkout. Every LastDonor campaign is human-verified before going live. LastDonor is a registered nonprofit; GoFundMe is a for-profit company. Donors on LastDonor receive verified receipts and impact updates showing exactly how their donation was used.",
          },
        },
        {
          '@type': 'Question',
          name: 'Can I donate without creating an account?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. You can donate as a guest on LastDonor without creating an account. No signup is required to browse campaigns or make a donation. You will receive an email receipt confirming your donation.',
          },
        },
      ],
    },
  ],
};

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
      {/* Single @graph block: WebPage + FAQPage. Cross-references to Organization
          and WebSite @id nodes defined in layout.tsx are resolvable because all
          @id values are absolute URIs on the same domain. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeSchemaGraph) }}
      />
      <HeroSection />
      {/* Executive Summary: server-rendered, landmark-isolated 50-word entity
          description. AI RAG ingestion pipelines chunk HTML by ARIA landmarks;
          this section provides a clean, JS-independent extraction target.
          The speakable cssSelector ".hero-summary" also targets the paragraph
          inside HeroSection for Google Assistant / AI Overview synthesis. */}
      <section aria-label="Executive Summary" className="bg-muted px-4 pb-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong>LastDonor.org</strong> is a 501(c)(3) nonprofit crowdfunding platform that
            charges <strong>0% platform fees</strong>, requires <strong>human editorial review</strong>{' '}
            of every campaign before publication, and provides{' '}
            <strong>verified photo-and-receipt impact updates</strong> for every donation
            — serving medical, emergency, veteran, and family fundraising campaigns across
            the United States. The only fee deducted is the standard Stripe payment
            processing charge of approximately 2.9% + $0.30.
          </p>
        </div>
      </section>
      <TrustBar />

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
                Browse all verified fundraising campaigns
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
                Fundraising Success Stories
              </h2>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                Real people, real campaigns, real results. Updates and verified outcomes from donors like you.
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
                        alt={post.title}
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
                Browse verified fundraising success stories
              </Link>
            </AnimateOnScroll>
          </div>
        </section>
      )}

      <Newsletter />
      <HomepageFAQ />
    </>
  );
}
