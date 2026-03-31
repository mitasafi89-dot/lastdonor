import 'server-only';

import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getSetting } from '@/lib/settings.server';

/**
 * Calculate auto-adjusted simulation volume based on the number of real
 * (non-simulated) active campaigns. Returns a multiplier:
 *   - -1: phase-out is disabled (not applicable)
 *   - 0.0: simulation should stop (high threshold reached)
 *   - 0.3: mid threshold
 *   - 0.7: low threshold
 *   - 1.0: below all thresholds (full volume)
 */
export async function calculateAutoVolume(): Promise<number> {
  const phaseOutEnabled = await getSetting('simulation.phase_out.enabled');
  if (!phaseOutEnabled) return -1;

  const thresholdLow = await getSetting('simulation.phase_out.threshold_low');
  const thresholdMid = await getSetting('simulation.phase_out.threshold_mid');
  const thresholdHigh = await getSetting('simulation.phase_out.threshold_high');

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.simulationFlag, false),
        inArray(campaigns.status, ['active', 'last_donor_zone']),
      ),
    );

  const realCampaigns = result.count;

  if (realCampaigns >= thresholdHigh) return 0.0;
  if (realCampaigns >= thresholdMid) return 0.3;
  if (realCampaigns >= thresholdLow) return 0.7;
  return 1.0;
}
