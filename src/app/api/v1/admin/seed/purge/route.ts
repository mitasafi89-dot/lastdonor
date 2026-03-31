import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { donations, campaignSeedMessages, campaigns, auditLogs } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['admin']);

    // 1. Count seed data before purge
    const [seedDonationStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
      })
      .from(donations)
      .where(eq(donations.source, 'seed'));

    const [seedMessageStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignSeedMessages);

    // 2. Delete seed donations
    await db.delete(donations).where(eq(donations.source, 'seed'));

    // 3. Delete seed messages
    await db.delete(campaignSeedMessages);

    // 4. Recalculate all campaign totals from remaining real donations
    const allCampaigns = await db
      .select({ id: campaigns.id })
      .from(campaigns);

    for (const campaign of allCampaigns) {
      const [realTotals] = await db
        .select({
          totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
          donorCount: sql<number>`count(*)::int`,
        })
        .from(donations)
        .where(
          and(
            eq(donations.campaignId, campaign.id),
            eq(donations.refunded, false),
          ),
        );

      await db
        .update(campaigns)
        .set({
          raisedAmount: realTotals.totalAmount,
          donorCount: realTotals.donorCount,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaign.id));
    }

    // 5. Audit log
    const purged = {
      donations: seedDonationStats.count,
      donationAmount: seedDonationStats.totalAmount,
      messages: seedMessageStats.count,
    };

    await db.insert(auditLogs).values({
      eventType: 'admin.seed_purge',
      actorId: session.user.id,
      actorRole: 'admin',
      severity: 'warning',
      details: { purged },
    });

    return NextResponse.json({ ok: true, data: { purged } });
  } catch (error) {
    if (error instanceof Error && (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError')) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'FORBIDDEN',
            message: error.message,
            requestId,
          },
        },
        { status: error.name === 'UnauthorizedError' ? 401 : 403 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to purge seed data',
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
