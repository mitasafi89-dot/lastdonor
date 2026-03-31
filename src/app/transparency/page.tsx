import type { Metadata } from 'next';
import { db } from '@/db';
import { campaigns, donations } from '@/db/schema';
import { eq, or, sql } from 'drizzle-orm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { centsToDollars } from '@/lib/utils/currency';

export const metadata: Metadata = {
  title: 'Transparency',
  description:
    'See exactly where every dollar goes. No hidden tips, no surprise fees, no fine print. We publish our numbers because we think you deserve to see them.',
  openGraph: {
    title: 'Transparency | LastDonor.org',
    description:
      'We publish our numbers because we think you deserve to see them. Zero hidden fees, full fund tracking.',
    images: [
      {
        url: '/api/v1/og/page?title=Transparency&subtitle=We+publish+our+numbers+because+we+think+you+deserve+to+see+them.',
        width: 1200,
        height: 630,
        alt: 'Transparency Report by LastDonor.org',
      },
    ],
  },
};

export const revalidate = 300;

async function getTransparencyData() {
  const [stats] = await db
    .select({
      totalRaised: sql<number>`COALESCE(SUM(CASE WHEN ${donations.source} = 'real' AND ${donations.refunded} = false THEN ${donations.amount} ELSE 0 END), 0)`,
      totalDonors: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${donations.source} = 'real' THEN ${donations.donorEmail} END), 0)`,
      totalDonations: sql<number>`COALESCE(COUNT(CASE WHEN ${donations.source} = 'real' AND ${donations.refunded} = false THEN 1 END), 0)`,
    })
    .from(donations);

  const [campaignStats] = await db
    .select({
      completed: sql<number>`COUNT(CASE WHEN ${campaigns.status} IN ('completed', 'archived') THEN 1 END)`,
      active: sql<number>`COUNT(CASE WHEN ${campaigns.status} IN ('active', 'last_donor_zone') THEN 1 END)`,
    })
    .from(campaigns);

  return {
    totalRaised: Number(stats?.totalRaised ?? 0),
    totalDonors: Number(stats?.totalDonors ?? 0),
    totalDonations: Number(stats?.totalDonations ?? 0),
    completedCampaigns: Number(campaignStats?.completed ?? 0),
    activeCampaigns: Number(campaignStats?.active ?? 0),
  };
}

export default async function TransparencyPage() {
  const data = await getTransparencyData();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs />
      <h1 className="mt-6 font-display text-4xl font-bold text-foreground">
        Transparency
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Some platforms hide a 15% tip on your donation and call it
        &quot;voluntary.&quot; We think that&apos;s wrong. Here are our numbers,
        out in the open, because you should know where your money goes before
        you give it.
      </p>

      {/* Platform Stats */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Raised So Far', value: centsToDollars(data.totalRaised) },
          { label: 'People Who Gave', value: data.totalDonors.toLocaleString('en-US') },
          { label: 'Campaigns Funded', value: data.completedCampaigns.toString() },
          { label: 'Campaigns Live Now', value: data.activeCampaigns.toString() },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-6 text-center"
          >
            <p className="font-mono text-2xl font-bold text-primary">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Fund Allocation */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-foreground">
          Where Every Dollar Goes
        </h2>
        <p className="mt-2 text-muted-foreground">
          No tip sliders. No &quot;processing fees&quot; that quietly double.
          This is the full breakdown.
        </p>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-semibold text-foreground">Straight to the Person in Need</p>
              <p className="text-sm text-muted-foreground">
                Directly to the individual or family. No middlemen, no detours.
              </p>
            </div>
            <span className="font-mono text-2xl font-bold text-primary">90%</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-semibold text-foreground">Payment Processing &amp; Operations</p>
              <p className="text-sm text-muted-foreground">
                Stripe fees, hosting, and the editorial team that verifies every campaign.
              </p>
            </div>
            <span className="font-mono text-2xl font-bold text-brand-amber">10%</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-semibold text-foreground">Hidden Tips or Surprise Fees</p>
              <p className="text-sm text-muted-foreground">
                Zero. We will never add a tip to your donation without your knowledge.
              </p>
            </div>
            <span className="font-mono text-2xl font-bold text-muted-foreground">0%</span>
          </div>
        </div>
      </section>

      {/* Policies */}
      <section className="mt-12 space-y-6">
        <h2 className="font-display text-2xl font-bold text-foreground">
          What We Promise
        </h2>
        <ul className="list-disc space-y-3 pl-6 text-muted-foreground">
          <li>
            Every donation is publicly recorded with the donor&apos;s name (or
            &quot;Anonymous&quot; if they choose), amount, date, and campaign.
          </li>
          <li>
            Every campaign includes cited, verifiable sources. If we can&apos;t
            verify it, we don&apos;t publish it.
          </li>
          <li>
            We publish a full breakdown after every completed campaign showing
            how the funds were used.
          </li>
          <li>
            Our IRS Form 990 will be published annually once available.
          </li>
          <li>
            We never sell, share, or monetize donor data. Period.
          </li>
          <li>
            If you ever have a question about where your money went, you can
            reach a real person who will actually answer it.
          </li>
        </ul>
      </section>
    </div>
  );
}
