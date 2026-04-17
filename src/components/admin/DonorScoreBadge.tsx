'use client';

import { getScoreLevel, SCORE_LEVEL_META } from '@/lib/donor-scoring';

interface DonorScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export function DonorScoreBadge({ score, size = 'md' }: DonorScoreBadgeProps) {
  const level = getScoreLevel(score);
  const meta = SCORE_LEVEL_META[level];

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${meta.color} ${meta.darkColor} ${sizeClasses}`}
      title={`Donor Score: ${score}/100 - ${meta.label}`}
    >
      <span className="font-mono font-bold">{score}</span>
      <span>{meta.label}</span>
    </span>
  );
}
