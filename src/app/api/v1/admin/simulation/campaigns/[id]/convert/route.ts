import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, fundPoolAllocations, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import type { ApiResponse, ApiError } from '@/types/api';
import type { SimulationConfig } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  try {
    const session = await requireRole(['admin']);
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid campaign ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const body = await request.json();
    const beneficiaryInfo = body?.beneficiaryInfo;

    if (!beneficiaryInfo || typeof beneficiaryInfo !== 'string' || beneficiaryInfo.trim().length < 5) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'beneficiaryInfo is required (min 5 characters)', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const [campaign] = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        simulationFlag: campaigns.simulationFlag,
      })
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign || !campaign.simulationFlag) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Simulated campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const newConfig: SimulationConfig = {
      paused: false,
      fundAllocation: 'located_beneficiary',
      beneficiaryInfo: beneficiaryInfo.trim(),
    };

    // Convert: set simulationFlag to false, update config
    await db
      .update(campaigns)
      .set({
        simulationFlag: false,
        simulationConfig: newConfig,
      })
      .where(eq(campaigns.id, id));

    // Transfer pending fund pool allocations to this campaign
    const now = new Date();
    await db
      .update(fundPoolAllocations)
      .set({
        targetCampaignId: id,
        status: 'allocated',
        allocatedAt: now,
      })
      .where(
        and(
          eq(fundPoolAllocations.sourceCampaignId, id),
          eq(fundPoolAllocations.status, 'pending'),
        ),
      );

    // Audit log
    await db.insert(auditLogs).values({
      eventType: 'simulation.campaign_converted',
      actorId: session.user.id,
      actorRole: session.user.role,
      targetType: 'campaign',
      targetId: id,
      severity: 'info',
      details: {
        campaignId: id,
        campaignTitle: campaign.title,
        beneficiaryInfo: beneficiaryInfo.trim(),
      },
    });

    const responseBody: ApiResponse<{ converted: true; campaignId: string }> = {
      ok: true,
      data: { converted: true, campaignId: id },
    };
    return NextResponse.json(responseBody);
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
