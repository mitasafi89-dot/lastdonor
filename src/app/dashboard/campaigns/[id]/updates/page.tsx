import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns, campaignUpdates } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { CampaignUpdatesClient } from '@/components/dashboard/CampaignUpdatesClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campaign Updates — Dashboard — LastDonor.org',
  robots: { index: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CampaignUpdatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard/campaigns');

  const [campaign] = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      status: campaigns.status,
      creatorId: campaigns.creatorId,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) notFound();
  if (campaign.creatorId !== session.user.id && !['editor', 'admin'].includes(session.user.role as string)) {
    redirect('/dashboard/campaigns');
  }

  const updates = await db
    .select({
      id: campaignUpdates.id,
      title: campaignUpdates.title,
      bodyHtml: campaignUpdates.bodyHtml,
      updateType: campaignUpdates.updateType,
      createdAt: campaignUpdates.createdAt,
    })
    .from(campaignUpdates)
    .where(eq(campaignUpdates.campaignId, id))
    .orderBy(desc(campaignUpdates.createdAt));

  const serialized = updates.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  const canPost = ['active', 'last_donor_zone'].includes(campaign.status);

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-foreground">Campaign Updates</h1>
      <p className="mt-1 text-sm text-muted-foreground">{campaign.title}</p>

      <CampaignUpdatesClient
        campaignId={id}
        updates={serialized}
        canPost={canPost}
      />
    </>
  );
}
