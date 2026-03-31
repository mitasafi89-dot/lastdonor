import Link from 'next/link';
import { ProgressBar } from '@/components/campaign/ProgressBar';
import { CampaignHeroImage } from '@/components/campaign/CampaignHeroImage';
import { centsToDollarsWhole } from '@/lib/utils/currency';
import { getCampaignPhase } from '@/lib/utils/phase';

interface CampaignCardProps {
  slug: string;
  title: string;
  heroImageUrl: string;
  subjectName: string;
  organizerName?: string;
  category?: string;
  location?: string | null;
  raisedAmount: number;
  goalAmount: number;
  donorCount?: number;
  verificationStatus?: string;
}

export function CampaignCard({
  slug,
  title,
  heroImageUrl,
  subjectName,
  category,
  location,
  raisedAmount,
  goalAmount,
  donorCount,
}: CampaignCardProps) {
  const percent = goalAmount > 0
    ? Math.min(Math.round((raisedAmount / goalAmount) * 100), 100)
    : 0;
  const phase = getCampaignPhase(raisedAmount, goalAmount);
  const isLastDonorZone = phase === 'last_donor_zone';

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        isLastDonorZone
          ? 'border-destructive/40 ring-2 ring-destructive/20'
          : 'border-border'
      }`}
    >
      <Link href={`/campaigns/${slug}`} className="flex flex-1 flex-col">
        {/* Hero image */}
        <div className="relative aspect-video overflow-hidden">
          <CampaignHeroImage
            src={heroImageUrl}
            alt={title}
            category={category}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Category badge */}
          {category && (
            <span className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium capitalize text-white backdrop-blur-sm">
              {category}
            </span>
          )}
          {/* Last Donor Zone badge */}
          {isLastDonorZone && (
            <span className="absolute right-3 top-3 animate-pulse rounded-full bg-destructive px-3 py-1 text-xs font-bold text-white">
              Almost there!
            </span>
          )}
          {/* Location */}
          {location && (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {location}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-card-foreground">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            by {subjectName}
          </p>

          {/* Progress section */}
          <div className="mt-auto pt-4">
            <ProgressBar raisedAmount={raisedAmount} goalAmount={goalAmount} />
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-sm font-bold text-foreground">
                {centsToDollarsWhole(raisedAmount)} raised
              </span>
              <span className="text-xs text-muted-foreground">
                {percent}%
              </span>
            </div>
            {donorCount !== undefined && (
              <p className="mt-1 text-xs text-muted-foreground">
                {donorCount.toLocaleString('en-US')} donor{donorCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
