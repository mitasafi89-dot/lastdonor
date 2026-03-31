import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import type { ApiResponse, ApiError } from '@/types/api';
import type { SimulationConfig } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
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

    const [campaign] = await db
      .select({
        id: campaigns.id,
        simulationFlag: campaigns.simulationFlag,
        simulationConfig: campaigns.simulationConfig,
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

    const config: SimulationConfig = (campaign.simulationConfig as SimulationConfig) ?? {
      paused: false,
      fundAllocation: 'pool',
    };
    config.paused = true;

    await db.update(campaigns).set({ simulationConfig: config }).where(eq(campaigns.id, id));

    await db.insert(auditLogs).values({
      eventType: 'simulation.campaign_paused',
      actorId: session.user.id,
      actorRole: session.user.role,
      targetType: 'campaign',
      targetId: id,
      severity: 'info',
      details: { campaignId: id },
    });

    const body: ApiResponse<{ paused: true }> = { ok: true, data: { paused: true } };
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
