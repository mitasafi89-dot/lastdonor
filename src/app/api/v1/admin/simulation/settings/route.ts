import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { getAllSettings, updateSettings } from '@/lib/settings.server';
import { calculateAutoVolume } from '@/lib/seed/phase-out';
import type { SettingsMap } from '@/lib/settings';
import type { ApiResponse, ApiError } from '@/types/api';

type SimulationSettings = {
  enabled: boolean;
  volume: number;
  maxConcurrent: number;
  minCycleMinutes: number;
  cohortChance: number;
  autoComplete: boolean;
  fundAllocationDefault: string;
  realisticTiming: boolean;
  pauseAll: boolean;
  phaseOut: {
    enabled: boolean;
    thresholdLow: number;
    thresholdMid: number;
    thresholdHigh: number;
  };
  effectiveVolume: number | null;
};

function mapToResponse(s: SettingsMap, effectiveVolume: number | null): SimulationSettings {
  return {
    enabled: s['simulation.enabled'],
    volume: s['simulation.volume_multiplier'],
    maxConcurrent: s['simulation.max_concurrent'],
    minCycleMinutes: s['simulation.min_cycle_minutes'],
    cohortChance: s['simulation.cohort_chance'],
    autoComplete: s['simulation.auto_complete'],
    fundAllocationDefault: s['simulation.fund_allocation_default'],
    realisticTiming: s['simulation.realistic_timing'],
    pauseAll: s['simulation.pause_all'],
    phaseOut: {
      enabled: s['simulation.phase_out.enabled'],
      thresholdLow: s['simulation.phase_out.threshold_low'],
      thresholdMid: s['simulation.phase_out.threshold_mid'],
      thresholdHigh: s['simulation.phase_out.threshold_high'],
    },
    effectiveVolume,
  };
}

export async function GET(_request: NextRequest) {
  const requestId = randomUUID();
  try {
    await requireRole(['admin']);
    const settings = await getAllSettings();

    const autoVolume = await calculateAutoVolume();
    const manualVolume = settings['simulation.volume_multiplier'];
    const effectiveVolume = autoVolume >= 0 ? Math.min(manualVolume, autoVolume) : manualVolume;

    const body: ApiResponse<SimulationSettings> = {
      ok: true,
      data: mapToResponse(settings, effectiveVolume),
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

export async function PUT(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const session = await requireRole(['admin']);
    const body = await request.json();

    // Validate and map updates
    const updates: Partial<SettingsMap> = {};
    const errors: string[] = [];

    if ('enabled' in body && typeof body.enabled === 'boolean') {
      updates['simulation.enabled'] = body.enabled;
    }
    if ('volume' in body) {
      const v = Number(body.volume);
      if (isNaN(v) || v < 0 || v > 1) errors.push('volume must be between 0.0 and 1.0');
      else updates['simulation.volume_multiplier'] = v;
    }
    if ('maxConcurrent' in body) {
      const v = Number(body.maxConcurrent);
      if (!Number.isInteger(v) || v < 1) errors.push('maxConcurrent must be a positive integer');
      else updates['simulation.max_concurrent'] = v;
    }
    if ('minCycleMinutes' in body) {
      const v = Number(body.minCycleMinutes);
      if (!Number.isInteger(v) || v < 1) errors.push('minCycleMinutes must be a positive integer');
      else updates['simulation.min_cycle_minutes'] = v;
    }
    if ('cohortChance' in body) {
      const v = Number(body.cohortChance);
      if (isNaN(v) || v < 0 || v > 1) errors.push('cohortChance must be between 0.0 and 1.0');
      else updates['simulation.cohort_chance'] = v;
    }
    if ('autoComplete' in body && typeof body.autoComplete === 'boolean') {
      updates['simulation.auto_complete'] = body.autoComplete;
    }
    if ('fundAllocationDefault' in body) {
      if (!['pool', 'located_beneficiary'].includes(body.fundAllocationDefault)) {
        errors.push('fundAllocationDefault must be "pool" or "located_beneficiary"');
      } else {
        updates['simulation.fund_allocation_default'] = body.fundAllocationDefault;
      }
    }
    if ('realisticTiming' in body && typeof body.realisticTiming === 'boolean') {
      updates['simulation.realistic_timing'] = body.realisticTiming;
    }
    if ('pauseAll' in body && typeof body.pauseAll === 'boolean') {
      updates['simulation.pause_all'] = body.pauseAll;
    }

    // Phase-out sub-object
    if (body.phaseOut && typeof body.phaseOut === 'object') {
      const po = body.phaseOut;
      if ('enabled' in po && typeof po.enabled === 'boolean') {
        updates['simulation.phase_out.enabled'] = po.enabled;
      }
      const low = po.thresholdLow != null ? Number(po.thresholdLow) : undefined;
      const mid = po.thresholdMid != null ? Number(po.thresholdMid) : undefined;
      const high = po.thresholdHigh != null ? Number(po.thresholdHigh) : undefined;

      if (low != null) {
        if (!Number.isInteger(low) || low < 1) errors.push('thresholdLow must be a positive integer');
        else updates['simulation.phase_out.threshold_low'] = low;
      }
      if (mid != null) {
        if (!Number.isInteger(mid) || mid < 1) errors.push('thresholdMid must be a positive integer');
        else updates['simulation.phase_out.threshold_mid'] = mid;
      }
      if (high != null) {
        if (!Number.isInteger(high) || high < 1) errors.push('thresholdHigh must be a positive integer');
        else updates['simulation.phase_out.threshold_high'] = high;
      }

      // Cross-validate threshold ordering if any are being set
      const finalLow = low ?? undefined;
      const finalMid = mid ?? undefined;
      const finalHigh = high ?? undefined;
      if (finalLow != null && finalMid != null && finalLow >= finalMid) {
        errors.push('thresholdLow must be less than thresholdMid');
      }
      if (finalMid != null && finalHigh != null && finalMid >= finalHigh) {
        errors.push('thresholdMid must be less than thresholdHigh');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: errors.join('; '), requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'No valid settings provided', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Capture old values for audit
    const oldSettings = await getAllSettings();

    await updateSettings(updates, session.user.id);

    // Audit log
    await db.insert(auditLogs).values({
      eventType: 'simulation.settings_changed',
      actorId: session.user.id,
      actorRole: session.user.role,
      severity: 'info',
      details: {
        changes: Object.fromEntries(
          Object.entries(updates).map(([k, v]) => [k, { old: (oldSettings as unknown as Record<string, unknown>)[k], new: v }]),
        ),
      },
    });

    // Return updated settings
    const newSettings = await getAllSettings();
    const autoVolume = await calculateAutoVolume();
    const effectiveVolume = autoVolume >= 0
      ? Math.min(newSettings['simulation.volume_multiplier'], autoVolume)
      : newSettings['simulation.volume_multiplier'];

    const responseBody: ApiResponse<SimulationSettings> = {
      ok: true,
      data: mapToResponse(newSettings, effectiveVolume),
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
