import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns, impactUpdates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ImpactUpdateForm } from './ImpactUpdateForm';

export const metadata: Metadata = {
  title: 'Impact Update - LastDonor.org',
  robots: { index: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ImpactUpdatePage({ params }: Props) {
  const { id: idOrSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');

  const campaignCondition = UUID_REGEX.test(idOrSlug)
    ? eq(campaigns.id, idOrSlug)
    : eq(campaigns.slug, idOrSlug);

  const [campaign] = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      creatorId: campaigns.creatorId,
    })
    .from(campaigns)
    .where(and(campaignCondition, eq(campaigns.creatorId, session.user.id)))
    .limit(1);

  if (!campaign) {
    redirect('/dashboard');
  }

  const [existing] = await db
    .select()
    .from(impactUpdates)
    .where(eq(impactUpdates.campaignId, campaign.id))
    .limit(1);

  const formattedExisting = existing ? {
    id: existing.id,
    title: existing.title,
    bodyHtml: existing.bodyHtml,
    photos: (existing.photos ?? []) as string[],
    receiptUrls: (existing.receiptUrls ?? []) as string[],
    status: existing.status,
    submittedAt: existing.submittedAt?.toISOString() ?? null,
    reviewedAt: existing.reviewedAt?.toISOString() ?? null,
    reviewerNotes: existing.reviewerNotes,
    dueDate: existing.dueDate?.toISOString() ?? null,
  } : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/dashboard/campaigns/${campaign.id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to campaign
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
        Impact Update
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share how the funds from &quot;{campaign.title}&quot; were used.
        Include photos and receipts to show your supporters the difference they made.
      </p>

      <ImpactUpdateForm
        campaignId={campaign.id}
        existing={formattedExisting}
      />
    </div>
  );
}
