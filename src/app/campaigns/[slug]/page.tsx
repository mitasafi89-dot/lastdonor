import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { campaigns, donations, campaignUpdates, campaignMessages, campaignMilestones, milestoneEvidence } from '@/db/schema';
import { publicCampaignSelect, publicMessageSelect, publicMilestoneSelect } from '@/db/public-select';
import { eq, and, desc, or } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ProgressBar } from '@/components/campaign/ProgressBar';
import { PhaseBadge } from '@/components/campaign/PhaseBadge';
import { type DonorFeedItem } from '@/components/campaign/DonorFeed';
import { CampaignUpdates } from '@/components/campaign/CampaignUpdates';
import { ShareButtons } from '@/components/campaign/ShareButtons';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/categories';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import { CampaignHeroImage } from '@/components/campaign/CampaignHeroImage';
import { TrustBadgeRow } from '@/components/campaigns/TrustBadge';
import { MilestoneTimeline } from '@/components/campaigns/MilestoneTimeline';
import { centsToDollars } from '@/lib/utils/currency';
import { getCampaignPhase } from '@/lib/utils/phase';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { cn } from '@/lib/utils';
import { CampaignDetailClient } from './client';
import type { ImpactTier, CampaignCategory } from '@/types';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getCampaign(slug: string) {
  const [campaign] = await db
    .select(publicCampaignSelect)
    .from(campaigns)
    .where(
      and(
        eq(campaigns.slug, slug),
        or(
          eq(campaigns.status, 'active'),
          eq(campaigns.status, 'last_donor_zone'),
          eq(campaigns.status, 'completed'),
          eq(campaigns.status, 'paused'),
          eq(campaigns.status, 'suspended'),
          eq(campaigns.status, 'cancelled'),
        ),
      ),
    )
    .limit(1);

  return campaign ?? null;
}

async function getRecentDonors(campaignId: string): Promise<DonorFeedItem[]> {
  const rows = await db
    .select({
      id: donations.id,
      donorName: donations.donorName,
      donorLocation: donations.donorLocation,
      amount: donations.amount,
      message: donations.message,
      isAnonymous: donations.isAnonymous,
      createdAt: donations.createdAt,
    })
    .from(donations)
    .where(eq(donations.campaignId, campaignId))
    .orderBy(desc(donations.createdAt))
    .limit(10);

  return rows.map((r) => ({
    id: r.id,
    donorName: r.isAnonymous ? 'Anonymous' : r.donorName,
    donorLocation: r.isAnonymous ? null : r.donorLocation,
    amount: r.amount,
    message: r.message,
    isAnonymous: r.isAnonymous,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function getUpdates(campaignId: string) {
  return db
    .select({
      id: campaignUpdates.id,
      title: campaignUpdates.title,
      bodyHtml: campaignUpdates.bodyHtml,
      imageUrl: campaignUpdates.imageUrl,
      createdAt: campaignUpdates.createdAt,
    })
    .from(campaignUpdates)
    .where(eq(campaignUpdates.campaignId, campaignId))
    .orderBy(desc(campaignUpdates.createdAt));
}

async function getMessages(campaignId: string) {
  const rows = await db
    .select(publicMessageSelect)
    .from(campaignMessages)
    .where(
      and(
        eq(campaignMessages.campaignId, campaignId),
        eq(campaignMessages.hidden, false),
      ),
    )
    .orderBy(desc(campaignMessages.createdAt))
    .limit(20);

  return rows.map((m) => ({
    id: m.id,
    donorName: m.isAnonymous ? 'Anonymous' : m.donorName,
    donorLocation: m.isAnonymous ? null : m.donorLocation,
    message: m.message,
    isAnonymous: m.isAnonymous,
    createdAt: m.createdAt.toISOString(),
  }));
}

async function getMilestones(campaignId: string) {
  return db
    .select(publicMilestoneSelect)
    .from(campaignMilestones)
    .where(eq(campaignMilestones.campaignId, campaignId))
    .orderBy(campaignMilestones.phase);
}

async function getApprovedEvidence(campaignId: string) {
  return db
    .select({
      milestoneId: milestoneEvidence.milestoneId,
      fileName: milestoneEvidence.fileName,
      fileUrl: milestoneEvidence.fileUrl,
      mimeType: milestoneEvidence.mimeType,
      reviewedAt: milestoneEvidence.reviewedAt,
    })
    .from(milestoneEvidence)
    .where(
      and(
        eq(milestoneEvidence.campaignId, campaignId),
        eq(milestoneEvidence.status, 'approved'),
      ),
    )
    .orderBy(milestoneEvidence.createdAt);
}

async function getRelatedCampaigns(category: CampaignCategory, _currentId: string) {
  return db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      heroImageUrl: campaigns.heroImageUrl,
      subjectName: campaigns.subjectName,
      subjectHometown: campaigns.subjectHometown,
      campaignOrganizer: campaigns.campaignOrganizer,
      category: campaigns.category,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
      donorCount: campaigns.donorCount,
      location: campaigns.location,
      verificationStatus: campaigns.verificationStatus,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.category, category),
        or(
          eq(campaigns.status, 'active'),
          eq(campaigns.status, 'last_donor_zone'),
        ),
      ),
    )
    .limit(4); // Fetch 4, filter out current below
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);

  if (!campaign) {
    return { title: 'Campaign Not Found' };
  }

  const percent = campaign.goalAmount > 0
    ? Math.round((campaign.raisedAmount / campaign.goalAmount) * 100)
    : 0;

  return {
    title: `${campaign.title} | LastDonor.org`,
    description: `${campaign.title}. ${percent}% funded — ${centsToDollars(campaign.raisedAmount)} of ${centsToDollars(campaign.goalAmount)} raised. Donate now.`,
    openGraph: {
      title: campaign.title,
      description: `${percent}% funded. ${centsToDollars(campaign.raisedAmount)} raised of ${centsToDollars(campaign.goalAmount)} goal.`,
      type: 'article',
      images: [
        {
          url: `/api/v1/og/campaign/${slug}`,
          width: 1200,
          height: 630,
          alt: campaign.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: campaign.title,
      description: `${percent}% funded. Donate now.`,
    },
  };
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const campaign = await getCampaign(slug);

  if (!campaign) {
    notFound();
  }

  const [recentDonors, updates, relatedRaw, initialMessages, milestones, approvedEvidence] = await Promise.all([
    getRecentDonors(campaign.id),
    getUpdates(campaign.id),
    getRelatedCampaigns(campaign.category, campaign.id),
    getMessages(campaign.id),
    getMilestones(campaign.id),
    getApprovedEvidence(campaign.id),
  ]);

  const relatedCampaigns = relatedRaw
    .filter((c) => c.id !== campaign.id)
    .slice(0, 3);

  const phase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);
  const percent = campaign.goalAmount > 0
    ? Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100)
    : 0;
  const impactTiers = (campaign.impactTiers ?? []) as ImpactTier[];
  const sanitizedStory = sanitizeHtml(campaign.storyHtml);
  const canonicalUrl = `https://lastdonor.org/campaigns/${slug}`;
  const isDonatable = campaign.status === 'active' || campaign.status === 'last_donor_zone';

  const formattedUpdates = updates.map((u) => ({
    id: u.id,
    title: u.title,
    bodyHtml: u.bodyHtml,
    imageUrl: u.imageUrl,
    createdAt: u.createdAt.toISOString(),
  }));

  // Group approved evidence by milestoneId
  const evidenceByMilestone = new Map<string, Array<{ fileName: string; fileUrl: string; mimeType: string; reviewedAt: string | null }>>();
  for (const e of approvedEvidence) {
    const arr = evidenceByMilestone.get(e.milestoneId) ?? [];
    arr.push({
      fileName: e.fileName,
      fileUrl: e.fileUrl,
      mimeType: e.mimeType,
      reviewedAt: e.reviewedAt?.toISOString() ?? null,
    });
    evidenceByMilestone.set(e.milestoneId, arr);
  }

  const formattedMilestones = milestones.map((m) => ({
    ...m,
    fundAmount: m.fundAmount ?? 0,
    fundAmountFormatted: centsToDollars(m.fundAmount ?? 0),
    evidence: evidenceByMilestone.get(m.id) ?? [],
  }));

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: campaign.title,
    image: campaign.heroImageUrl,
    author: {
      '@type': 'Organization',
      name: 'LastDonor.org',
    },
    publisher: {
      '@type': 'Organization',
      name: 'LastDonor.org',
      url: 'https://lastdonor.org',
    },
    datePublished: campaign.publishedAt?.toISOString(),
    dateModified: campaign.updatedAt.toISOString(),
    description: `Fundraising campaign for ${campaign.subjectName}. ${percent}% funded.`,
  };

  const donateJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DonateAction',
    recipient: {
      '@type': 'Organization',
      name: 'LastDonor.org',
    },
    description: `Donate to help ${campaign.subjectName}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donateJsonLd) }}
      />

      <article className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Main content grid */}
        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Left column — image + story + details */}
          <div className="space-y-6">
            {/* Hero image — GoFundMe-style: 3:2 ratio, capped height, inside content column */}
            <div className={cn('relative overflow-hidden rounded-lg bg-muted')}>
              <div className="relative aspect-[3/2] max-h-[420px]">
                <CampaignHeroImage
                  src={campaign.heroImageUrl}
                  alt={campaign.title}
                  category={campaign.category}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 660px"
                  className="object-cover"
                />
                {/* Subtle status pill on hero — no gradient overlay, no opacity reduction */}
                {campaign.status === 'paused' && (
                  <div className="absolute bottom-3 left-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50/95 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm ring-1 ring-amber-200/80 backdrop-blur-sm">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      Paused
                    </span>
                  </div>
                )}
                {campaign.status === 'suspended' && (
                  <div className="absolute bottom-3 left-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/95 px-3 py-1.5 text-xs font-medium text-blue-800 shadow-sm ring-1 ring-blue-200/80 backdrop-blur-sm">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                      Verification in progress
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Inline status notice — friendly, informational tone */}
            {campaign.status === 'paused' && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">This campaign is taking a short break</p>
                  <p className="mt-0.5 text-sm text-amber-700/90 dark:text-amber-300/90">{campaign.pausedReason ?? 'Donations are not being accepted right now. The campaign may resume soon.'}</p>
                </div>
              </div>
            )}
            {campaign.status === 'suspended' && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 dark:border-blue-800/50 dark:bg-blue-950/30">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">We&apos;re verifying this campaign</p>
                  <p className="mt-0.5 text-sm text-blue-700/90 dark:text-blue-300/90">{campaign.suspendedReason ?? 'Our team is reviewing a few details. Any existing donations are safe and secure.'}</p>
                </div>
              </div>
            )}

            {/* Photo credit */}
            {campaign.photoCredit && (
              <p className="-mt-4 text-right text-xs text-muted-foreground">
                {campaign.photoCredit}
              </p>
            )}

            {/* Title & meta */}
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                {campaign.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-base text-muted-foreground">
                  {campaign.subjectName}
                  {campaign.subjectHometown && ` · ${campaign.subjectHometown}`}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'border-0 text-xs',
                    CATEGORY_COLORS[campaign.category],
                  )}
                >
                  {CATEGORY_LABELS[campaign.category]}
                </Badge>
              </div>

              {/* Trust badges */}
              <TrustBadgeRow
                verificationStatus={campaign.verificationStatus}
                milestones={milestones}
                totalReleased={campaign.totalReleasedAmount}
                raisedAmount={campaign.raisedAmount}
                className="mt-2"
              />
            </div>

            {/* Progress section */}
            <div className="rounded-xl border border-border bg-card p-5">
              <ProgressBar
                raisedAmount={campaign.raisedAmount}
                goalAmount={campaign.goalAmount}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-2xl font-bold text-card-foreground">
                    {centsToDollars(campaign.raisedAmount)}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    of {centsToDollars(campaign.goalAmount)} goal
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {campaign.donorCount} {campaign.donorCount === 1 ? 'donor' : 'donors'}
                  </span>
                  <PhaseBadge phase={phase} />
                </div>
              </div>
            </div>

            {/* Cancellation/rejection notice — shown before story for full transparency */}
            {campaign.status === 'cancelled' && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-5 dark:border-red-800/50 dark:bg-red-950/30">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  <div>
                    <p className="text-sm font-semibold text-red-900 dark:text-red-200">This campaign has been removed</p>
                    {campaign.cancellationReason && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-red-800/70 dark:text-red-300/70">Reason for removal</p>
                        <p className="mt-0.5 text-sm text-red-800 dark:text-red-200">{campaign.cancellationReason}</p>
                      </div>
                    )}
                    {campaign.cancellationNotes && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-red-800/70 dark:text-red-300/70">Additional details</p>
                        <p className="mt-0.5 text-sm text-red-800 dark:text-red-200">{campaign.cancellationNotes}</p>
                      </div>
                    )}
                    {campaign.cancelledAt && (
                      <p className="mt-2 text-xs text-red-600/80 dark:text-red-400/80">
                        Removed on {new Date(campaign.cancelledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Campaign story */}
            <div
              className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-display prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: sanitizedStory }}
            />

            {/* Milestone timeline — below the story for transparency */}
            {formattedMilestones.length > 0 && (
              <MilestoneTimeline milestones={formattedMilestones} />
            )}

            {/* Updates */}
            {formattedUpdates.length > 0 && (
              <CampaignUpdates updates={formattedUpdates} />
            )}

            {/* Share */}
            <ShareButtons url={canonicalUrl} title={campaign.title} />

            {/* Report inaccuracy */}
            <div className="border-t border-border pt-4">
              <a
                href={`mailto:editorial@lastdonor.org?subject=Report: ${encodeURIComponent(campaign.title)}`}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Report an inaccuracy
              </a>
            </div>
          </div>

          {/* Right column — donation form + impact tiers + donor feed (desktop) */}
          <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {isDonatable ? (
              <CampaignDetailClient
                campaignSlug={campaign.slug}
                raisedAmount={campaign.raisedAmount}
                goalAmount={campaign.goalAmount}
                donorCount={campaign.donorCount}
                impactTiers={impactTiers}
                initialDonors={recentDonors}
                initialMessages={initialMessages}
              />
            ) : campaign.status === 'completed' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/50">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                  <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-200">Campaign Complete</p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">This campaign has reached its goal. Thank you to all {campaign.donorCount} {campaign.donorCount === 1 ? 'donor' : 'donors'}!</p>
                <p className="mt-3 font-mono text-lg font-bold text-emerald-800 dark:text-emerald-200">{centsToDollars(campaign.raisedAmount)} raised</p>
              </div>
            ) : campaign.status === 'paused' ? (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-6 dark:border-amber-800/40 dark:bg-amber-950/20">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100/80 dark:bg-amber-900/40">
                  <svg className="h-6 w-6 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <p className="text-center font-medium text-amber-900 dark:text-amber-200">Taking a short break</p>
                <p className="mt-1 text-center text-sm text-amber-700/80 dark:text-amber-300/80">{campaign.pausedReason ?? 'This campaign is not accepting donations right now. Check back soon.'}</p>
                <div className="mt-4 rounded-lg bg-amber-100/40 px-4 py-3 dark:bg-amber-900/20">
                  <p className="text-center font-mono text-lg font-bold text-amber-900 dark:text-amber-200">{centsToDollars(campaign.raisedAmount)}</p>
                  <p className="text-center text-xs text-amber-600/80 dark:text-amber-400/80">raised from {campaign.donorCount} {campaign.donorCount === 1 ? 'donor' : 'donors'}</p>
                </div>
                <Link href="/campaigns" className="mt-4 block rounded-lg border border-amber-200/60 bg-white px-4 py-2.5 text-center text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/30">
                  Browse other campaigns
                </Link>
              </div>
            ) : campaign.status === 'suspended' ? (
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-6 dark:border-blue-800/40 dark:bg-blue-950/20">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100/80 dark:bg-blue-900/40">
                  <svg className="h-6 w-6 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                </div>
                <p className="text-center font-medium text-blue-900 dark:text-blue-200">Verification in progress</p>
                <p className="mt-1 text-center text-sm text-blue-700/80 dark:text-blue-300/80">{campaign.suspendedReason ?? 'Our team is reviewing a few details to keep donations safe.'}</p>
                <div className="mt-4 flex items-center justify-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                  <span>All donations are secure</span>
                </div>
                <Link href="/campaigns" className="mt-4 block rounded-lg border border-blue-200/60 bg-white px-4 py-2.5 text-center text-sm font-medium text-blue-800 transition-colors hover:bg-blue-50 dark:border-blue-700/40 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/30">
                  Browse other campaigns
                </Link>
              </div>
            ) : campaign.status === 'cancelled' ? (
              <div className="rounded-xl border border-red-200/80 bg-red-50/60 p-6 dark:border-red-800/40 dark:bg-red-950/20">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100/80 dark:bg-red-900/40">
                  <svg className="h-6 w-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                </div>
                <p className="text-center font-medium text-red-900 dark:text-red-200">Campaign removed</p>
                <p className="mt-1 text-center text-sm text-red-700/80 dark:text-red-300/80">This campaign did not meet our editorial standards and has been removed from the platform.</p>
                {(campaign.raisedAmount > 0) && (
                  <div className="mt-3 rounded-lg bg-red-100/40 px-4 py-2 dark:bg-red-900/20">
                    <p className="text-center text-xs text-red-600 dark:text-red-400">Donors have been notified and refunds processed where applicable.</p>
                  </div>
                )}
                <Link href="/campaigns" className="mt-4 block rounded-lg border border-red-200/60 bg-white px-4 py-2.5 text-center text-sm font-medium text-red-800 transition-colors hover:bg-red-50 dark:border-red-700/40 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/30">
                  Browse active campaigns
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-muted-foreground">Donations are not available for this campaign.</p>
              </div>
            )}
          </div>
        </div>

        {/* Related campaigns */}
        {relatedCampaigns.length > 0 && (
          <section className="mt-16 border-t border-border pt-8">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Similar Campaigns
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCampaigns.map((rc) => (
                <CampaignCard
                  key={rc.id}
                  slug={rc.slug}
                  title={rc.title}
                  heroImageUrl={rc.heroImageUrl}
                  subjectName={rc.subjectName}
                  category={rc.category}
                  location={rc.location || rc.subjectHometown}
                  raisedAmount={rc.raisedAmount}
                  goalAmount={rc.goalAmount}
                />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
