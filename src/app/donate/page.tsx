import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { DonationForm } from '@/components/campaign/DonationForm';
import { GENERAL_FUND_CAMPAIGN_ID } from '@/lib/constants';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donate to the General Fund',
  description:
    'Support LastDonor.org directly. General fund donations cover campaign verification, payment processing, and platform hosting. No hidden tips.',
  alternates: { canonical: '/donate' },
  openGraph: {
    title: 'Donate to the General Fund | LastDonor.org',
    description:
      'General fund donations keep the lights on so we can respond fast when someone needs help.',
    images: [
      {
        url: '/api/v1/og/page?title=Donate+to+the+General+Fund&subtitle=Support+LastDonor.org+directly.',
        width: 1200,
        height: 630,
        alt: 'Donate to the General Fund at LastDonor.org',
      },
    ],
  },
};

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs />
      <h1 className="mt-6 font-display text-3xl font-bold text-foreground">
        Support the General Fund
      </h1>
      <p className="mt-3 text-muted-foreground">
        General fund donations keep the lights on so we can respond fast when
        someone needs help. They cover campaign verification, payment
        processing, and platform hosting. No hidden tips. What you give is
        what you give.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <DonationForm campaignId={GENERAL_FUND_CAMPAIGN_ID} campaignTitle="General Fund" />
      </div>
    </div>
  );
}
