'use client';

import { useRouter } from 'next/navigation';
import { SidebarDonationSummary } from '@/components/campaign/SidebarDonationSummary';
import { ImpactTiers } from '@/components/campaign/ImpactTiers';
import { DonorFeed, type DonorFeedItem } from '@/components/campaign/DonorFeed';
import { MessageWall, type MessageItem } from '@/components/campaign/MessageWall';
import { MessageForm } from '@/components/campaign/MessageForm';
import { StickyMobileDonateBar } from '@/components/campaign/StickyMobileDonateBar';
import type { ImpactTier } from '@/types';

interface CampaignDetailClientProps {
  campaignSlug: string;
  raisedAmount: number;
  goalAmount: number;
  donorCount: number;
  impactTiers: ImpactTier[];
  initialDonors: DonorFeedItem[];
  initialMessages: MessageItem[];
}

export function CampaignDetailClient({
  campaignSlug,
  raisedAmount,
  goalAmount,
  donorCount,
  impactTiers,
  initialDonors,
  initialMessages,
}: CampaignDetailClientProps) {
  const router = useRouter();
  const donateHref = `/campaigns/${campaignSlug}/donate`;

  return (
    <>
      {/* Sidebar summary card */}
      <SidebarDonationSummary
        raisedAmount={raisedAmount}
        goalAmount={goalAmount}
        donorCount={donorCount}
        donateHref={donateHref}
      />

      {impactTiers.length > 0 && (
        <ImpactTiers
          tiers={impactTiers}
          onSelectAmount={(cents) => router.push(`${donateHref}?amount=${cents}`)}
        />
      )}

      <DonorFeed
        campaignSlug={campaignSlug}
        initialDonors={initialDonors}
      />

      <MessageForm campaignSlug={campaignSlug} />

      <MessageWall
        campaignSlug={campaignSlug}
        initialMessages={initialMessages}
      />

      {/* Mobile sticky donate bar */}
      <StickyMobileDonateBar
        raisedAmount={raisedAmount}
        goalAmount={goalAmount}
        donateHref={donateHref}
      />
    </>
  );
}
