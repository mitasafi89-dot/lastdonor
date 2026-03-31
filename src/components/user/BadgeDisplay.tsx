'use client';

import { Badge } from '@/components/ui/badge';
import { TrophyIcon, StarIcon, HeartIcon } from '@heroicons/react/24/outline';
import type { UserBadge } from '@/types';

const BADGE_CONFIG: Record<string, { icon: typeof TrophyIcon; label: string; color: string }> = {
  last_donor: {
    icon: TrophyIcon,
    label: 'Last Donor',
    color: 'bg-brand-amber/10 text-brand-amber border-brand-amber/20',
  },
  first_believer: {
    icon: StarIcon,
    label: 'First Believer',
    color: 'bg-brand-teal/10 text-brand-teal border-brand-teal/20',
  },
  recurring: {
    icon: HeartIcon,
    label: 'Recurring Donor',
    color: 'bg-brand-green/10 text-brand-green border-brand-green/20',
  },
};

interface BadgeDisplayProps {
  badges: UserBadge[];
}

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (!badges.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge, i) => {
        const config = BADGE_CONFIG[badge.type];
        if (!config) return null;
        const Icon = config.icon;
        return (
          <Badge key={`${badge.type}-${badge.campaignSlug}-${i}`} variant="outline" className={config.color}>
            <Icon className="mr-1 h-3.5 w-3.5" />
            {config.label}
          </Badge>
        );
      })}
    </div>
  );
}
