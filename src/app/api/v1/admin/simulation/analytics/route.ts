import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, donations, fundPoolAllocations } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import type { ApiResponse, ApiError } from '@/types/api';

export async function GET(_request: NextRequest) {
  const requestId = randomUUID();
  try {
    await requireRole(['admin']);

    // Campaign counts by type (simulated vs real) and status
    const campaignCounts = await db
      .select({
        simulationFlag: campaigns.simulationFlag,
        status: campaigns.status,
        count: sql<number>`count(*)::int`,
      })
      .from(campaigns)
      .groupBy(campaigns.simulationFlag, campaigns.status);

    const simulated = { active: 0, completed: 0, archived: 0, total: 0 };
    const real = { active: 0, completed: 0, archived: 0, total: 0 };

    for (const row of campaignCounts) {
      const target = row.simulationFlag ? simulated : real;
      if (row.status === 'active' || row.status === 'last_donor_zone') target.active += row.count;
      else if (row.status === 'completed') target.completed += row.count;
      else if (row.status === 'archived') target.archived += row.count;
      target.total += row.count;
    }

    // Donation totals by source
    const donationTotals = await db
      .select({
        source: donations.source,
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
      })
      .from(donations)
      .groupBy(donations.source);

    const seedDonations = { count: 0, total: 0 };
    const realDonations = { count: 0, total: 0 };
    for (const d of donationTotals) {
      if (d.source === 'seed') {
        seedDonations.count = d.count;
        seedDonations.total = d.total;
      } else {
        realDonations.count = d.count;
        realDonations.total = d.total;
      }
    }

    // Seed-to-real ratio (real as percentage of total)
    const totalAll = seedDonations.count + realDonations.count;
    const ratioPercent = totalAll > 0 ? Math.round((realDonations.count / totalAll) * 1000) / 10 : 0;

    // Fund pool summary
    const poolSummary = await db
      .select({
        status: fundPoolAllocations.status,
        total: sql<number>`coalesce(sum(${fundPoolAllocations.amount}), 0)::int`,
      })
      .from(fundPoolAllocations)
      .groupBy(fundPoolAllocations.status);

    const fundPool = { pending: 0, allocated: 0, disbursed: 0 };
    for (const p of poolSummary) {
      if (p.status === 'pending') fundPool.pending = p.total;
      else if (p.status === 'allocated') fundPool.allocated = p.total;
      else if (p.status === 'disbursed') fundPool.disbursed = p.total;
    }

    // Per-category breakdown
    const categoryBreakdown = await db
      .select({
        category: campaigns.category,
        simulationFlag: campaigns.simulationFlag,
        count: sql<number>`count(*)::int`,
      })
      .from(campaigns)
      .where(inArray(campaigns.status, ['active', 'last_donor_zone', 'completed']))
      .groupBy(campaigns.category, campaigns.simulationFlag);

    // Category donation totals
    const categoryDonations = await db
      .select({
        category: campaigns.category,
        source: donations.source,
        total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
      })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .groupBy(campaigns.category, donations.source);

    // Build category data
    const categoryMap = new Map<string, {
      category: string;
      simulated: number;
      real: number;
      seedDonations: number;
      realDonations: number;
    }>();

    for (const row of categoryBreakdown) {
      if (!categoryMap.has(row.category)) {
        categoryMap.set(row.category, {
          category: row.category,
          simulated: 0,
          real: 0,
          seedDonations: 0,
          realDonations: 0,
        });
      }
      const entry = categoryMap.get(row.category)!;
      if (row.simulationFlag) entry.simulated += row.count;
      else entry.real += row.count;
    }

    for (const row of categoryDonations) {
      if (!categoryMap.has(row.category)) {
        categoryMap.set(row.category, {
          category: row.category,
          simulated: 0,
          real: 0,
          seedDonations: 0,
          realDonations: 0,
        });
      }
      const entry = categoryMap.get(row.category)!;
      if (row.source === 'seed') entry.seedDonations += row.total;
      else entry.realDonations += row.total;
    }

    const categories = Array.from(categoryMap.values()).sort(
      (a, b) => (b.realDonations + b.seedDonations) - (a.realDonations + a.seedDonations),
    );

    const body: ApiResponse<{
      campaigns: { simulated: typeof simulated; real: typeof real };
      donations: { seed: typeof seedDonations; real: typeof realDonations };
      ratio: { current: number };
      fundPool: typeof fundPool;
      categories: typeof categories;
    }> = {
      ok: true,
      data: {
        campaigns: { simulated, real },
        donations: { seed: seedDonations, real: realDonations },
        ratio: { current: ratioPercent },
        fundPool,
        categories,
      },
    };
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
