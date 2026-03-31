import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { centsToDollars } from '@/lib/utils/currency';
import { DonatePageClient } from './client';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getDonatableCampaign(slug: string) {
  const [campaign] = await db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      subjectName: campaigns.subjectName,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
      donorCount: campaigns.donorCount,
      status: campaigns.status,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.slug, slug),
        or(
          eq(campaigns.status, 'active'),
          eq(campaigns.status, 'last_donor_zone'),
        ),
      ),
    )
    .limit(1);

  return campaign ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getDonatableCampaign(slug);

  if (!campaign) {
    return { title: 'Campaign Not Found' };
  }

  return {
    title: `Donate to ${campaign.title} | LastDonor.org`,
    description: `Make a donation to help ${campaign.subjectName}. ${centsToDollars(campaign.raisedAmount)} raised of ${centsToDollars(campaign.goalAmount)} goal.`,
    robots: { index: false },
  };
}

export default async function DonatePage({ params, searchParams }: PageProps) {
  const [{ slug }, resolvedParams] = await Promise.all([params, searchParams]);
  const campaign = await getDonatableCampaign(slug);

  if (!campaign) {
    notFound();
  }

  // Parse URL params for Stripe redirect return and amount preselection
  const rawAmount = typeof resolvedParams.amount === 'string'
    ? parseInt(resolvedParams.amount, 10)
    : undefined;
  const initialAmount = rawAmount && rawAmount >= 500 && rawAmount <= 10_000_000
    ? rawAmount
    : undefined;
  const isDonationSuccess = resolvedParams.donation === 'success';
  const paymentIntentId = typeof resolvedParams.payment_intent === 'string'
    ? resolvedParams.payment_intent
    : undefined;

  return (
    <DonatePageClient
      campaignId={campaign.id}
      campaignSlug={campaign.slug}
      campaignTitle={campaign.title}
      raisedAmount={campaign.raisedAmount}
      goalAmount={campaign.goalAmount}
      donorCount={campaign.donorCount}
      initialAmount={initialAmount}
      isDonationSuccess={isDonationSuccess}
      paymentIntentId={paymentIntentId}
    />
  );
}
