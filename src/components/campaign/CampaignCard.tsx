import Link from 'next/link';
import { ProgressBar } from '@/components/campaign/ProgressBar';
import { CampaignHeroImage } from '@/components/campaign/CampaignHeroImage';
import { centsToDollarsWhole } from '@/lib/utils/currency';

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
  verificationStatus?: string;
}

export function CampaignCard({
  slug,
  title,
  heroImageUrl,
  category,
  location,
  raisedAmount,
  goalAmount,
}: CampaignCardProps) {
  return (
    <article className="group flex h-full flex-col">
      <Link href={`/campaigns/${slug}`} className="flex flex-1 flex-col">
        {/* Hero image with optional location badge */}
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          <CampaignHeroImage
            src={heroImageUrl}
            alt={title}
            category={category}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {location && (
            <span className="absolute bottom-2 left-2 hidden rounded bg-black/60 px-2 py-1 text-xs font-medium text-white md:block">
              {location}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col pt-3">
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-foreground">
            {title}
          </h3>

          {/* Progress — pushed to bottom */}
          <div className="mt-auto pt-2">
            <ProgressBar raisedAmount={raisedAmount} goalAmount={goalAmount} />
            <p className="mt-1 text-sm font-medium text-foreground">
              {centsToDollarsWhole(raisedAmount)} raised
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
