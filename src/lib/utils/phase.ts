import type { DonationPhase } from '@/types';

export function getCampaignPhase(raisedAmount: number, goalAmount: number): DonationPhase {
  if (goalAmount <= 0) return 'first_believers';
  const percent = Math.floor((raisedAmount / goalAmount) * 100);
  if (percent <= 25) return 'first_believers';
  if (percent <= 60) return 'the_push';
  if (percent <= 90) return 'closing_in';
  return 'last_donor_zone';
}

export function getPhaseLabel(phase: DonationPhase): string {
  const labels: Record<DonationPhase, string> = {
    first_believers: 'First Believers',
    the_push: 'The Push',
    closing_in: 'Closing In',
    last_donor_zone: 'Last Donor Zone',
  };
  return labels[phase];
}

export function getPhasePercentRange(phase: DonationPhase): { min: number; max: number } {
  const ranges: Record<DonationPhase, { min: number; max: number }> = {
    first_believers: { min: 0, max: 25 },
    the_push: { min: 26, max: 60 },
    closing_in: { min: 61, max: 90 },
    last_donor_zone: { min: 91, max: 100 },
  };
  return ranges[phase];
}
