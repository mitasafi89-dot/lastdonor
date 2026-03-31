import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, donations, fundPoolAllocations } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import type { ApiResponse, ApiError } from '@/types/api';
import type { SimulationConfig } from '@/types';

interface SimulatedCampaignRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string;
  raisedAmount: number;
  goalAmount: number;
  donorCount: number;
  simulationConfig: SimulationConfig | null;
  createdAt: Date;
}

export async function GET(_request: NextRequest) {
  const requestId = randomUUID();
  try {
    await requireRole(['admin']);

    // Fetch simulated campaigns
    const simCampaigns = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        category: campaigns.category,
        raisedAmount: campaigns.raisedAmount,
        goalAmount: campaigns.goalAmount,
        donorCount: campaigns.donorCount,
        simulationConfig: campaigns.simulationConfig,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .where(eq(campaigns.simulationFlag, true));

    // Get donation stats per campaign (real vs seed) in a single query
    const donationStats = await db
      .select({
        campaignId: donations.campaignId,
        source: donations.source,
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
      })
      .from(donations)
      .where(
        inArray(
          donations.campaignId,
          simCampaigns.map((c) => c.id),
        ),
      )
      .groupBy(donations.campaignId, donations.source);

    // Get fund pool pending per campaign
    const poolStats = await db
      .select({
        sourceCampaignId: fundPoolAllocations.sourceCampaignId,
        pending: sql<number>`coalesce(sum(${fundPoolAllocations.amount}), 0)::int`,
      })
      .from(fundPoolAllocations)
      .where(eq(fundPoolAllocations.status, 'pending'))
      .groupBy(fundPoolAllocations.sourceCampaignId);

    // Build lookup maps
    const statsByIdSource = new Map<string, { count: number; total: number }>();
    for (const s of donationStats) {
      statsByIdSource.set(`${s.campaignId}:${s.source}`, { count: s.count, total: s.total });
    }
    const poolById = new Map(poolStats.map((p) => [p.sourceCampaignId, p.pending]));

    const data = simCampaigns.map((c: SimulatedCampaignRow) => {
      const real = statsByIdSource.get(`${c.id}:real`) ?? { count: 0, total: 0 };
      const seed = statsByIdSource.get(`${c.id}:seed`) ?? { count: 0, total: 0 };
      const config = c.simulationConfig;
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        status: c.status,
        category: c.category,
        progress: c.goalAmount > 0 ? Math.round((c.raisedAmount / c.goalAmount) * 100) : 0,
        raisedAmount: c.raisedAmount,
        goalAmount: c.goalAmount,
        donorCount: c.donorCount,
        realDonationCount: real.count,
        realDonationTotal: real.total,
        seedDonationCount: seed.count,
        seedDonationTotal: seed.total,
        fundPoolPending: poolById.get(c.id) ?? 0,
        paused: config?.paused ?? false,
        createdAt: c.createdAt.toISOString(),
      };
    });

    // Summary meta
    const totalActive = data.filter((c) => c.status === 'active' || c.status === 'last_donor_zone').length;
    const totalPaused = data.filter((c) => c.paused).length;
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const completedThisMonth = simCampaigns.filter(
      (c) => c.status === 'completed' && c.createdAt >= thisMonthStart,
    ).length;

    const body: ApiResponse<typeof data> = {
      ok: true,
      data,
      meta: { totalActive, totalPaused, completedThisMonth } as Record<string, unknown>,
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
