import { NextRequest, NextResponse } from 'next/server';
import { runSimulation } from '@/lib/seed/simulation-engine';
import { calculateAutoVolume } from '@/lib/seed/phase-out';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getSetting } from '@/lib/settings.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Guard: only run if simulation is enabled via settings
  const enabled = await getSetting('simulation.enabled');
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      data: { skipped: true, reason: 'simulation.enabled is false' },
    });
  }

  // Check global pause
  const pauseAll = await getSetting('simulation.pause_all');
  if (pauseAll) {
    return NextResponse.json({
      ok: true,
      data: { skipped: true, reason: 'simulation.pause_all is true' },
    });
  }

  try {
    const manualVolume = await getSetting('simulation.volume_multiplier');
    const autoVolume = await calculateAutoVolume();

    // Use the lower of manual and auto-computed volume
    const effectiveVolume = autoVolume >= 0 ? Math.min(manualVolume, autoVolume) : manualVolume;

    if (effectiveVolume === 0) {
      return NextResponse.json({
        ok: true,
        data: { skipped: true, reason: 'Effective volume is 0 (phase-out or manual)' },
      });
    }

    const result = await runSimulation(effectiveVolume);

    await db.insert(auditLogs).values({
      eventType: 'cron.simulate_donations',
      severity: result.errors.length > 0 ? 'warning' : 'info',
      details: result,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    await db.insert(auditLogs).values({
      eventType: 'cron.simulate_donations',
      severity: 'error',
      details: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
