import type { DonorScoreLevel } from '@/types';

interface ScoreInput {
  totalDonated: number;        // cents
  lastDonationAt: Date | null;
  donationCount: number;
  hasRecurring: boolean;
  name: string | null;
  location: string | null;
  avatarUrl: string | null;
  address: unknown;
  preferences: unknown;
}

/**
 * RFM-based donor scoring algorithm.
 *
 * Recency (R)   — 0-30 pts: how recently they donated
 * Frequency (F) — 0-30 pts: how many donations total
 * Monetary (M)  — 0-30 pts: lifetime value in dollars
 * Engagement (E) — 0-10 pts: profile completeness + engagement signals
 *
 * Total: 0-100
 */
export function computeDonorScore(input: ScoreInput): number {
  const r = recencyScore(input.lastDonationAt);
  const f = frequencyScore(input.donationCount);
  const m = monetaryScore(input.totalDonated);
  const e = engagementScore(input);
  return r + f + m + e;
}

function recencyScore(lastDonation: Date | null): number {
  if (!lastDonation) return 0;
  const daysSince = Math.floor((Date.now() - lastDonation.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince <= 7) return 30;
  if (daysSince <= 30) return 25;
  if (daysSince <= 90) return 20;
  if (daysSince <= 180) return 15;
  if (daysSince <= 365) return 10;
  return 5;
}

function frequencyScore(count: number): number {
  if (count >= 20) return 30;
  if (count >= 10) return 25;
  if (count >= 5) return 20;
  if (count >= 3) return 15;
  if (count >= 2) return 10;
  if (count >= 1) return 5;
  return 0;
}

function monetaryScore(totalCents: number): number {
  const dollars = totalCents / 100;
  if (dollars >= 10000) return 30;
  if (dollars >= 5000) return 25;
  if (dollars >= 1000) return 20;
  if (dollars >= 500) return 15;
  if (dollars >= 100) return 10;
  if (dollars > 0) return 5;
  return 0;
}

function engagementScore(input: ScoreInput): number {
  let score = 0;
  if (input.name) score += 2;
  if (input.location || hasAddress(input.address)) score += 2;
  if (input.avatarUrl) score += 2;
  if (input.hasRecurring) score += 2;
  if (hasPreferencesSet(input.preferences)) score += 2;
  return score;
}

function hasAddress(address: unknown): boolean {
  if (!address || typeof address !== 'object') return false;
  const a = address as Record<string, string>;
  return !!(a.city || a.country || a.street);
}

function hasPreferencesSet(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== 'object') return false;
  const p = prefs as Record<string, unknown>;
  // At least one preference has been explicitly set (not just defaults)
  return Object.keys(p).some((k) => k.startsWith('email') && typeof p[k] === 'boolean');
}

export function getScoreLevel(score: number): DonorScoreLevel {
  if (score >= 81) return 'champion';
  if (score >= 61) return 'engaged';
  if (score >= 41) return 'warm';
  if (score >= 21) return 'cool';
  return 'cold';
}

export const SCORE_LEVEL_META: Record<DonorScoreLevel, { label: string; color: string; darkColor: string }> = {
  champion: { label: 'Champion', color: 'bg-emerald-100 text-emerald-800', darkColor: 'dark:bg-emerald-950 dark:text-emerald-300' },
  engaged:  { label: 'Engaged',  color: 'bg-blue-100 text-blue-800',    darkColor: 'dark:bg-blue-950 dark:text-blue-300' },
  warm:     { label: 'Warm',     color: 'bg-amber-100 text-amber-800',   darkColor: 'dark:bg-amber-950 dark:text-amber-300' },
  cool:     { label: 'Cool',     color: 'bg-orange-100 text-orange-800', darkColor: 'dark:bg-orange-950 dark:text-orange-300' },
  cold:     { label: 'Cold',     color: 'bg-red-100 text-red-800',       darkColor: 'dark:bg-red-950 dark:text-red-300' },
};
