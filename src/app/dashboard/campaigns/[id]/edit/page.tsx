import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CampaignEditClient } from '@/components/dashboard/CampaignEditClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Campaign — Dashboard — LastDonor.org',
  robots: { index: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
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
      category: campaigns.category,
      storyHtml: campaigns.storyHtml,
      heroImageUrl: campaigns.heroImageUrl,
      photoCredit: campaigns.photoCredit,
      subjectName: campaigns.subjectName,
      subjectHometown: campaigns.subjectHometown,
      fundUsagePlan: campaigns.fundUsagePlan,
      creatorId: campaigns.creatorId,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) notFound();
  if (campaign.creatorId !== session.user.id && !['editor', 'admin'].includes(session.user.role as string)) {
    redirect('/dashboard/campaigns');
  }

  if (!['draft', 'active'].includes(campaign.status)) {
    redirect(`/dashboard/campaigns/${id}`);
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-foreground">Edit Campaign</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update your campaign details. Changes are saved immediately.
      </p>
      <div className="mt-6">
        <CampaignEditClient
          campaign={{
            id: campaign.id,
            title: campaign.title ?? '',
            story: campaign.storyHtml ?? '',
            category: campaign.category ?? '',
            heroImageUrl: campaign.heroImageUrl ?? '',
            photoCredit: campaign.photoCredit ?? '',
            subjectHometown: campaign.subjectHometown ?? '',
            fundUsagePlan: campaign.fundUsagePlan ?? '',
          }}
        />
      </div>
    </>
  );
}
