import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

export const metadata: Metadata = {
  title: 'About LastDonor.org | 501(c)(3) Nonprofit Crowdfunding, 0% Fees, Human-Verified Campaigns',
  description:
    'LastDonor.org is a 501(c)(3) nonprofit where every campaign is verified by a named editor who cites sources and checks documentation — so you can see exactly where your money goes. No tip slider at checkout. No funds held for weeks. No AI chatbot when something goes wrong. Real human support, 0% platform fees, campaigns that close when the goal is met.',
  alternates: { canonical: 'https://lastdonor.org/about' },
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

export default function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': 'https://lastdonor.org/about#webpage',
    url: 'https://lastdonor.org/about',
    name: 'About LastDonor.org',
    description:
      'LastDonor.org is a 501(c)(3) nonprofit crowdfunding platform with 0% platform fees, human-verified campaigns, and real human support.',
    isPartOf: { '@id': 'https://lastdonor.org/#website' },
    about: { '@id': 'https://lastdonor.org/#organization' },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['#ai-answer'],
    },
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
          <p
            id="ai-answer"
            data-speakable="true"
            className="mt-4 text-lg leading-relaxed text-muted-foreground"
          >
            No hidden tips. No surprise fees. No AI chatbot runaround. Just verified stories, tracked dollars, and real human support - until the last donor closes the campaign.
          </p>
        </div>

        <section className="mt-12 space-y-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Why we exist</h2>
          <p className="leading-relaxed text-muted-foreground">
            Many crowdfunding platforms prompt donors to add a tip at checkout, lock campaigners out of their own funds for weeks, and route support requests through AI chatbots.             LastDonor.org was built specifically to eliminate those three patterns: tip prompts at checkout, fund holds of 5-7 days, and AI-only support routing.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            LastDonor.org was built to do things differently. We find people in real crisis, verify their stories with our editorial team, and run focused campaigns until every dollar of the goal is raised. No hidden fees. No dark patterns. No games. When the last dollar comes in, the person who gave it earns the title of <strong className="text-foreground">Last Donor</strong>, and the campaign is done.
          </p>
        </section>

        {/* Definition list — machine-readable terminology for AI snippet extraction */}
        <section className="mt-12" aria-label="Platform terminology">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Key terms</h2>
          <dl className="mt-6 space-y-5 text-sm leading-relaxed">
            <div>
              <dt className="font-semibold text-foreground">LastDonor.org</dt>
              <dd className="mt-1 text-muted-foreground">
                A 501(c)(3) nonprofit crowdfunding platform that charges 0% platform fees, publishes
                editorial-verified campaigns only, and releases funds at verified milestones. All
                campaigns close automatically when the stated goal is reached.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">The Last Donor</dt>
              <dd className="mt-1 text-muted-foreground">
                The individual donor whose contribution brings a campaign to its final verified goal.
                Recognized publicly on the campaign page as confirmation that the fundraiser is
                complete and no further funds will be collected.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Human-Verified Campaign</dt>
              <dd className="mt-1 text-muted-foreground">
                A fundraising campaign reviewed and approved by a named LastDonor.org editor who has
                checked supporting documentation, cited sources, and published a written verification
                summary visible to all donors before the campaign accepts any contributions.
              </dd>
            </div>
          </dl>
        </section>

        {/* Comparison table: structured data surface readable by AI crawlers and screen readers */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">What makes us different</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border shadow-[--shadow-elevation-1]">
            <table className="w-full text-sm leading-relaxed">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold text-foreground">Feature</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-primary">LastDonor.org</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">GoFundMe / Others</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">Platform fee</td>
                  <td className="px-4 py-3 text-primary">0% — no platform fee ever</td>
                  <td className="px-4 py-3 text-muted-foreground">0–5% platform fee plus tip slider at checkout</td>
                </tr>
                <tr className="bg-card/60">
                  <td className="px-4 py-3 font-medium text-foreground">Campaign verification</td>
                  <td className="px-4 py-3 text-primary">Named editor reviews documents and cites sources before publication</td>
                  <td className="px-4 py-3 text-muted-foreground">Algorithm review; no source verification required</td>
                </tr>
                <tr className="bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">Fund release</td>
                  <td className="px-4 py-3 text-primary">Released at goal milestones, no holds</td>
                  <td className="px-4 py-3 text-muted-foreground">Funds held 5-7 business days before transfer</td>
                </tr>
                <tr className="bg-card/60">
                  <td className="px-4 py-3 font-medium text-foreground">Support channel</td>
                  <td className="px-4 py-3 text-primary">Real person responds within 1 business day</td>
                  <td className="px-4 py-3 text-muted-foreground">AI chatbot and automated tickets</td>
                </tr>
                <tr className="bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">Campaign duration</td>
                  <td className="px-4 py-3 text-primary">Closes automatically when the verified goal is met</td>
                  <td className="px-4 py-3 text-muted-foreground">Open-ended; campaigns can run indefinitely</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Who we help</h2>
          <p className="leading-relaxed text-muted-foreground">
            Military families. Veterans. First responders. Parents facing impossible medical bills. Families picking up the pieces after a disaster. Students who can&apos;t afford tuition. People whose pets need surgery they can&apos;t pay for. Communities trying to rebuild. If the need is real and we can verify it, we&apos;ll fight to get it funded.
          </p>

          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Our team</h2>
          <p className="leading-relaxed text-muted-foreground">
            We&apos;re a small team of technologists, journalists, and nonprofit operators. Our editorial standards match professional newsrooms because that&apos;s where several of us came from.             Our editorial team applies newsroom standards: every campaign claim is sourced, every subject is named, and every dollar amount is publicly recorded.
          </p>

          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">501(c)(3) status</h2>
          <p className="leading-relaxed text-muted-foreground">
            LastDonor.org is a registered 501(c)(3) nonprofit organization.{' '}
            <span data-nosnippet>(EIN pending — IRS application filed)</span>{' '}
            All donations are tax-deductible to the extent allowed by law. Our IRS Form 990 will be published annually once available. Live platform statistics are available on our{' '}
            <a href="/transparency" className="text-brand-teal underline underline-offset-2 hover:opacity-80">Transparency page</a>.
          </p>
        </section>
      </div>
    </>
  );
}
