import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { CongratulationsClient } from './client';

export const metadata: Metadata = {
  title: 'Your Campaign Is Live! | LastDonor.org',
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CongratulationsPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/campaigns/${slug}/congratulations`);
  }

  const [campaign] = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      heroImageUrl: campaigns.heroImageUrl,
      category: campaigns.category,
      subjectName: campaigns.subjectName,
      subjectHometown: campaigns.subjectHometown,
      goalAmount: campaigns.goalAmount,
      raisedAmount: campaigns.raisedAmount,
      donorCount: campaigns.donorCount,
      creatorId: campaigns.creatorId,
      campaignOrganizer: campaigns.campaignOrganizer,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.slug, slug),
        eq(campaigns.creatorId, session.user.id),
      ),
    )
    .limit(1);

  if (!campaign) {
    notFound();
  }

  const campaignUrl = `${process.env.NEXTAUTH_URL || 'https://lastdonor.org'}/campaigns/${campaign.slug}`;

  return (
    <CongratulationsClient
      campaign={{
        title: campaign.title,
        slug: campaign.slug,
        heroImageUrl: campaign.heroImageUrl,
        category: campaign.category,
        subjectName: campaign.subjectName,
        subjectHometown: campaign.subjectHometown,
        goalAmount: campaign.goalAmount,
        raisedAmount: campaign.raisedAmount,
        donorCount: campaign.donorCount,
        campaignOrganizer: campaign.campaignOrganizer as { name: string; relation: string; city?: string } | null,
      }}
      campaignUrl={campaignUrl}
      creatorName={session.user.name ?? 'you'}
    />
  );
}
