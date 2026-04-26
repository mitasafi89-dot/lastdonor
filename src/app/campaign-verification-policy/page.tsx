import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Campaign Verification Policy',
  description:
    'How LastDonor reviews campaigns before publication, verifies campaign recipients, requests supporting documents, and handles inaccurate or non-compliant fundraisers.',
  alternates: { canonical: 'https://lastdonor.org/campaign-verification-policy' },
  openGraph: {
    title: 'Campaign Verification Policy | LastDonor.org',
    description:
      'How LastDonor reviews campaigns, verifies recipients, requests documents, and handles non-compliant fundraisers.',
    images: [
      {
        url: '/api/v1/og/page?title=Verification+Policy&subtitle=How+campaigns+are+reviewed+before+publication+and+fund+release.',
        width: 1200,
        height: 630,
        alt: 'Campaign Verification Policy at LastDonor.org',
      },
    ],
  },
};

export default function CampaignVerificationPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs />
      <h1 className="mt-6 font-display text-4xl font-bold text-foreground">
        Campaign Verification Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: April 27, 2026
      </p>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        LastDonor reviews campaigns before publication and requires additional
        verification before funds are released. Review reduces risk for donors,
        but it is not a guarantee that every fact will remain complete or
        unchanged after publication.
      </p>

      <div className="mt-10 space-y-9 text-muted-foreground">
        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">
            What We Review Before Publication
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>The campaign purpose, category, location, beneficiary, and fundraising goal.</li>
            <li>The organizer relationship to the beneficiary.</li>
            <li>Whether the story is specific enough for donors to understand the need.</li>
            <li>Whether claims can be supported by documents, public sources, photos, or direct follow-up.</li>
            <li>Whether the campaign appears to violate LastDonor rules, payment processor rules, or applicable law.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Documents and Evidence We May Request
          </h2>
          <p className="mt-3 leading-relaxed">
            Required evidence depends on the fundraiser. Examples include:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>Medical bills, treatment estimates, insurance notices, or provider letters.</li>
            <li>Repair invoices, funeral home estimates, school invoices, or emergency expense records.</li>
            <li>Identity documents, organizer authorization, beneficiary consent, or relationship confirmation.</li>
            <li>Photos, news links, official statements, public records, or third-party references.</li>
            <li>Bank or payout verification through Stripe Connect when funds are eligible for release.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Verification Statuses
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li><strong className="text-foreground">Pending:</strong> The campaign is submitted or awaiting review.</li>
            <li><strong className="text-foreground">Documents uploaded:</strong> Supporting materials have been submitted.</li>
            <li><strong className="text-foreground">Identity verified:</strong> Required identity checks have passed.</li>
            <li><strong className="text-foreground">Fully verified:</strong> Review requirements are complete and funds may become available for withdrawal.</li>
            <li><strong className="text-foreground">Info requested:</strong> LastDonor needs more information before moving forward.</li>
            <li><strong className="text-foreground">Rejected or suspended:</strong> The campaign cannot proceed unless the issue is resolved.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Ongoing Review
          </h2>
          <p className="mt-3 leading-relaxed">
            LastDonor may pause, suspend, edit, or remove a campaign if new
            information raises concerns. We may also request more documents,
            ask for an impact update, limit withdrawals, or refund donors when
            appropriate.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">
            What We Do Not Allow
          </h2>
          <p className="mt-3 leading-relaxed">
            Campaigns must follow our{' '}
            <Link href="/campaign-rules" className="text-primary underline underline-offset-4">
              Campaign Rules
            </Link>
            . We do not publish campaigns that involve illegal activity,
            misleading claims, sanctions violations, prohibited goods or
            services, hate or harassment, personal investment schemes, gambling,
            adult content, controlled substances, weapons, or other high-risk
            uses that LastDonor or its payment partners cannot support.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Reporting Inaccurate Information
          </h2>
          <p className="mt-3 leading-relaxed">
            If you believe a campaign contains inaccurate information, email{' '}
            <a href="mailto:editorial@lastdonor.org" className="text-primary underline underline-offset-4">
              editorial@lastdonor.org
            </a>{' '}
            with the campaign name, the issue, and any supporting details. We
            review reports and may update, pause, suspend, or remove campaigns.
          </p>
        </section>
      </div>
    </div>
  );
}
