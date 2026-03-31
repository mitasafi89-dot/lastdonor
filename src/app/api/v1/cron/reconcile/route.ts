import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, donations, auditLogs, fundPoolAllocations, notifications, users } from '@/db/schema';
import { eq, and, sql, lt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      discrepancies: 0,
      archived: 0,
      fundPoolAlerts: 0,
      errors: [] as string[],
    };

    // 1. Reconcile Stripe totals with DB totals (real donations only)
    const completedCampaigns = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, 'completed'));

    for (const campaign of completedCampaigns) {
      try {
        // Get sum of real, non-refunded donations from DB
        const [dbTotal] = await db
          .select({
            totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
            donorCount: sql<number>`count(*)::int`,
          })
          .from(donations)
          .where(
            and(
              eq(donations.campaignId, campaign.id),
              eq(donations.source, 'real'),
              eq(donations.refunded, false),
            ),
          );

        // Check for discrepancy (stripe reconciliation skipped for seed-only campaigns)
        const realDonationTotal = dbTotal.totalAmount;
        // dbRaisedReal includes seed donations - using realDonationTotal instead

        // Get actual seed total
        const [seedTotal] = await db
          .select({
            totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
          })
          .from(donations)
          .where(
            and(
              eq(donations.campaignId, campaign.id),
              eq(donations.source, 'seed'),
              eq(donations.refunded, false),
            ),
          );

        const expectedTotal = realDonationTotal + seedTotal.totalAmount;
        const discrepancy = Math.abs(campaign.raisedAmount - expectedTotal);

        if (discrepancy > 100) {
          // More than $1 discrepancy
          results.discrepancies++;

          await db.insert(auditLogs).values({
            eventType: 'reconcile.discrepancy',
            targetType: 'campaign',
            targetId: campaign.id,
            severity: 'warning',
            details: {
              campaignRaisedAmount: campaign.raisedAmount,
              calculatedTotal: expectedTotal,
              realTotal: realDonationTotal,
              seedTotal: seedTotal.totalAmount,
              discrepancy,
            },
          });

          // Auto-correct the campaign total
          await db
            .update(campaigns)
            .set({ raisedAmount: expectedTotal, updatedAt: new Date() })
            .where(eq(campaigns.id, campaign.id));
        }
      } catch (error) {
        results.errors.push(`Reconcile error for campaign ${campaign.id}: ${String(error)}`);
      }
    }

    // 2. Auto-archive campaigns completed > 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const toArchive = await db
      .select({ id: campaigns.id, title: campaigns.title })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, 'completed'),
          lt(campaigns.completedAt, ninetyDaysAgo),
        ),
      );

    for (const campaign of toArchive) {
      await db
        .update(campaigns)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id));

      results.archived++;
    }

    // 3. Fund Pool health check — alert admin if pending funds exceed $1,000
    const [pendingPool] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${fundPoolAllocations.amount}), 0)::int`,
      })
      .from(fundPoolAllocations)
      .where(eq(fundPoolAllocations.status, 'pending'));

    if (pendingPool.total > 100_000) {
      results.fundPoolAlerts++;

      // Find admin user for notification
      const [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1);

      if (admin) {
        await db.insert(notifications).values({
          userId: admin.id,
          type: 'campaign_status_changed',
          title: 'Fund Pool Alert',
          message: `$${(pendingPool.total / 100).toFixed(2)} in pending fund pool allocations (${pendingPool.count} donations). Review in admin panel.`,
          link: '/admin/simulation/fund-pool',
        });
      }
    }

    // Log completion
    await db.insert(auditLogs).values({
      eventType: 'cron.reconcile',
      severity: results.discrepancies > 0 || results.errors.length > 0 ? 'warning' : 'info',
      details: results,
    });

    return NextResponse.json({ ok: true, data: results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
