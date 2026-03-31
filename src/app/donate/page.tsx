'use client';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { DonationForm } from '@/components/campaign/DonationForm';

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
        <DonationForm campaignId="general_fund" campaignTitle="General Fund" />
      </div>
    </div>
  );
}
