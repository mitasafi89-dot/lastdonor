'use client';

import { Badge } from '@/components/ui/badge';
import type { CampaignStatus } from '@/types';

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  active: { label: 'Active', variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700' },
  last_donor_zone: { label: 'Last Donor Zone', variant: 'default', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  completed: { label: 'Completed', variant: 'default', className: 'bg-teal-700 hover:bg-teal-800' },
  archived: { label: 'Archived', variant: 'outline' },
  paused: { label: 'Paused', variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  under_review: { label: 'Under Review', variant: 'secondary', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive', className: 'bg-red-800 hover:bg-red-900 text-white' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus | string }) {
  const config = STATUS_CONFIG[status as CampaignStatus] ?? { label: status, variant: 'outline' as const };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
