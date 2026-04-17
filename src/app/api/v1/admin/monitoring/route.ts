import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getAICostSummary, getDailyCostTrend, getCostByPromptType } from '@/lib/monitoring/ai-cost-tracker';
import { getSimulationQuality, getPipelineHealth } from '@/lib/monitoring/pipeline-health';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
  }

  try {
    const [costSummary, costTrend, costByPromptType, simulationQuality, pipelineHealth] =
      await Promise.all([
        getAICostSummary(),
        getDailyCostTrend(30),
        getCostByPromptType(30),
        getSimulationQuality(),
        getPipelineHealth(),
      ]);

    return NextResponse.json({
      ok: true,
      data: {
        aiCosts: {
          summary: costSummary,
          trend: costTrend,
          byPromptType: costByPromptType,
        },
        simulationQuality,
        pipelineHealth,
      },
    });
  } catch (error) {
    const { logError } = await import('@/lib/errors');
    logError(error, { requestId, route: '/api/v1/admin/monitoring', method: 'GET' });
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load monitoring data.', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
