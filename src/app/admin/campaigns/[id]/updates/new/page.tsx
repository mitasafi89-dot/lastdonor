import { notFound } from 'next/navigation';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CampaignUpdateForm } from '@/components/admin/CampaignUpdateForm';
import type { Metadata } from 'next';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: 'New Campaign Update — Admin — LastDonor.org',
  robots: { index: false },
};

export default async function NewCampaignUpdatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const [campaign] = await db
    .select({ id: campaigns.id, title: campaigns.title })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) notFound();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">
        Post Campaign Update
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        for {campaign.title}
      </p>
      <div className="mt-6">
        <CampaignUpdateForm campaignId={campaign.id} />
      </div>
    </div>
  );
}
