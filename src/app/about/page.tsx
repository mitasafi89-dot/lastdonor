import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import {
  CheckBadgeIcon,
  CurrencyDollarIcon,
  EyeIcon,
  UserGroupIcon,
  FlagIcon,
} from '@heroicons/react/24/solid';

export const metadata: Metadata = {
  title: 'About',
  description:
    'LastDonor.org is crowdfunding built on trust. No hidden tips, no AI chatbot runaround, no surprise fees. Every campaign is verified by a real person and tracked with full transparency.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About LastDonor.org',
    description:
      'Crowdfunding built on trust. No hidden tips, no surprise fees. Every campaign verified by real people.',
    images: [
      {
        url: '/api/v1/og/page?title=About+LastDonor.org&subtitle=Crowdfunding+built+on+trust.+No+hidden+tips%2C+no+surprise+fees.',
        width: 1200,
        height: 630,
        alt: 'About LastDonor.org',
      },
    ],
  },
};

const DIFFERENTIATORS = [
  {
    Icon: CheckBadgeIcon,
    title: 'Every campaign verified by a real person',
    body: 'Not an algorithm. Our editorial team researches each story, checks documentation, and cites sources. Donors can give with confidence.',
  },
  {
    Icon: CurrencyDollarIcon,
    title: 'Zero hidden fees, zero tip sliders',
    body: 'LastDonor charges 0% platform fees. The only deduction from your donation is Stripe\u2019s standard payment processing fee (2.9% + $0.30 per transaction). At least 90% of every donation reaches the person in need. No hosting surcharges, no editorial levies, no surprise tips at checkout.',
  },
  {
    Icon: EyeIcon,
    title: 'You can track every dollar',
    body: 'Every donation is publicly recorded. You can see who gave, how much was raised, and when the campaign was completed. Full receipts, always.',
  },
  {
    Icon: UserGroupIcon,
    title: 'Real human support',
    body: 'If something goes wrong, you talk to a person. Not a chatbot. Email support@lastdonor.org and a real team member responds within 1 business day.',
  },
  {
    Icon: FlagIcon,
    title: 'Campaigns have an endpoint',
    body: 'We don\u2019t run open-ended fundraisers that drag on forever. Each campaign has a specific goal and closes when it\u2019s met.',
  },
];

export default function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': 'https://lastdonor.org/about#webpage',
    url: 'https://lastdonor.org/about',
    name: 'About LastDonor.org',
    description:
      'Crowdfunding built on trust. Every campaign is verified, every dollar is tracked, and there are zero hidden fees.',
    isPartOf: { '@id': 'https://lastdonor.org/#website' },
    about: { '@id': 'https://lastdonor.org/#organization' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs />

        {/* Hero - lede establishes Unity ("we got tired...") and Framing. */}
        <div className="mt-6 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-teal ring-1 ring-brand-teal/20">
            <CheckBadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            501(c)(3) Nonprofit
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Crowdfunding built on trust.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            No hidden tips. No surprise fees. No AI chatbot runaround. Just verified stories, tracked dollars, and real human support - until the last donor closes the campaign.
          </p>
        </div>

        <section className="mt-12 space-y-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Why we exist</h2>
          <p className="leading-relaxed text-muted-foreground">
            Many crowdfunding platforms prompt donors to add a tip at checkout, lock campaigners out of their own funds for weeks, and route support requests through AI chatbots. We got tired of watching that happen.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            LastDonor.org was built to do things differently. We find people in real crisis, verify their stories with our editorial team, and run focused campaigns until every dollar of the goal is raised. No hidden fees. No dark patterns. No games. When the last dollar comes in, the person who gave it earns the title of <strong className="text-foreground">Last Donor</strong>, and the campaign is done.
          </p>
        </section>

        {/* Enclosure: differentiators become tangible, scannable cards. */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">What makes us different</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {DIFFERENTIATORS.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-5 shadow-[--shadow-elevation-1] transition-shadow hover:shadow-[--shadow-elevation-2]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal/10 ring-1 ring-brand-teal/20">
                  <Icon className="h-5 w-5 text-brand-teal" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-semibold text-card-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Who we help</h2>
          <p className="leading-relaxed text-muted-foreground">
            Military families. Veterans. First responders. Parents facing impossible medical bills. Families picking up the pieces after a disaster. Students who can&apos;t afford tuition. People whose pets need surgery they can&apos;t pay for. Communities trying to rebuild. If the need is real and we can verify it, we&apos;ll fight to get it funded.
          </p>

          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Our team</h2>
          <p className="leading-relaxed text-muted-foreground">
            We&apos;re a small team of technologists, journalists, and nonprofit operators. Our editorial standards match professional newsrooms because that&apos;s where several of us came from. We care about getting things right more than getting things fast.
          </p>

          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">501(c)(3) status</h2>
          <p className="leading-relaxed text-muted-foreground">
            LastDonor.org is a registered 501(c)(3) nonprofit organization (EIN: [PENDING IRS ASSIGNMENT]). All donations are tax-deductible to the extent allowed by law. Our IRS Form 990 will be published annually once available. Live platform statistics are available on our{' '}
            <a href="/transparency" className="text-brand-teal underline underline-offset-2 hover:opacity-80">Transparency page</a>.
          </p>
        </section>
      </div>
    </>
  );
}
