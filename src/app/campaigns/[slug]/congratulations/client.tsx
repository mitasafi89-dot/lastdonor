'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShareButtons } from '@/components/campaign/ShareButtons';
import { CampaignHeroImage } from '@/components/campaign/CampaignHeroImage';
import { CATEGORY_LABELS } from '@/lib/categories';
import { centsToDollars } from '@/lib/utils/currency';
import type { CampaignCategory } from '@/types';

interface CongratsProps {
  campaign: {
    title: string;
    slug: string;
    heroImageUrl: string | null;
    category: string;
    subjectName: string;
    subjectHometown: string | null;
    goalAmount: number;
    raisedAmount: number;
    donorCount: number;
    campaignOrganizer: { name: string; relation: string; city?: string } | null;
  };
  campaignUrl: string;
  creatorName: string;
}

export function CongratulationsClient({ campaign, campaignUrl, creatorName }: CongratsProps) {
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    navigator.clipboard.writeText(campaignUrl).then(
      () => {
        setCopied(true);
        import('sonner').then(({ toast }) => toast.success('Link copied!'));
        setTimeout(() => setCopied(false), 3000);
      },
      () => {
        import('sonner').then(({ toast }) => toast.error('Could not copy link'));
      },
    );
  }

  const categoryLabel = CATEGORY_LABELS[campaign.category as CampaignCategory] ?? campaign.category;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Success header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
          <svg className="h-8 w-8 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Your Campaign Is Live!
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Share it now to get your first donation
        </p>
      </div>

      {/* Campaign preview card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {campaign.heroImageUrl && (
          <CampaignHeroImage
            src={campaign.heroImageUrl}
            alt={campaign.title}
            className="aspect-[16/9] w-full object-cover"
          />
        )}
        <div className="p-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-teal-600 dark:text-teal-400">
            {categoryLabel}
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">
            {campaign.title}
          </h2>
          {campaign.subjectHometown && (
            <p className="mt-1 text-sm text-muted-foreground">
              {campaign.subjectHometown}
            </p>
          )}

          {/* Goal display */}
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{centsToDollars(campaign.raisedAmount)}</span>
            <span className="text-sm text-muted-foreground">raised of {centsToDollars(campaign.goalAmount)} goal</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-500"
              style={{ width: `${Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100)}%` }}
            />
          </div>

          {/* Organizer + trust badge */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
              {(campaign.campaignOrganizer?.name ?? creatorName).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {campaign.campaignOrganizer?.name ?? creatorName} is organizing this fundraiser
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Be the first to donate CTA */}
      <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center dark:border-teal-800 dark:bg-teal-950/30">
        <h3 className="font-display text-lg font-bold text-foreground">
          Be the first to donate
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your donation signals trust and encourages others to give
        </p>
        <Link
          href={`/donate?campaign=${campaign.slug}`}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Donate Now
        </Link>
      </div>

      {/* Sharing section */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-lg font-bold text-foreground">
          Sharing helps more than you think
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Campaigns shared within the first hour raise significantly more. 
          Send your link to 5 friends or family members now.
        </p>

        {/* Copy link */}
        <button
          onClick={handleCopyLink}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent/50"
        >
          <span className="truncate text-sm text-muted-foreground">{campaignUrl}</span>
          <span className="ml-3 shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </button>

        {/* Social share buttons */}
        <div className="mt-4">
          <ShareButtons url={campaignUrl} title={campaign.title} />
        </div>

        {/* Sharing tips */}
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium text-foreground">Quick sharing tips:</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-teal-600">1.</span>
              <span><strong>Text or WhatsApp 5 close contacts</strong> — personal messages convert 10x better</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-teal-600">2.</span>
              <span><strong>Post on social media</strong> — add a personal note about why this matters</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-teal-600">3.</span>
              <span><strong>Email your network</strong> — sometimes the simplest approach works best</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/campaigns/${campaign.slug}`}
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          View Your Campaign
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
