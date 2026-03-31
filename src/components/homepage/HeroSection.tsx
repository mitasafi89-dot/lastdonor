import Image from 'next/image';
import Link from 'next/link';
import { centsToDollars } from '@/lib/utils/currency';
import { ShieldCheckIcon, CurrencyDollarIcon, HeartIcon } from '@heroicons/react/24/outline';

interface FeaturedCampaign {
  slug: string;
  title: string;
  heroImageUrl: string;
  subjectName: string;
  campaignOrganizer?: string;
  category?: string;
  raisedAmount: number;
  goalAmount: number;
}

interface HeroSectionProps {
  featuredCampaign: FeaturedCampaign | null;
}

export function HeroSection({ featuredCampaign }: HeroSectionProps) {
  const percent = featuredCampaign && featuredCampaign.goalAmount > 0
    ? Math.min(Math.round((featuredCampaign.raisedAmount / featuredCampaign.goalAmount) * 100), 100)
    : 0;

  return (
    <section className="relative overflow-hidden bg-background">
      {/* Subtle mesh gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column: Copy + CTAs + Trust metrics */}
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              You Know Exactly Where Your Money Goes
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              No hidden tips. No surprise fees. Just verified campaigns for real
              people, with every dollar tracked from your wallet to their hands.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/campaigns"
                className="rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-accent-foreground shadow-md transition-all hover:bg-accent/90 hover:shadow-lg"
              >
                Donate Now
              </Link>
              <Link
                href="/share-your-story"
                className="rounded-full border border-primary/30 bg-primary/5 px-8 py-3.5 text-sm font-semibold text-primary transition-all hover:bg-primary/10"
              >
                Start a Campaign
              </Link>
            </div>

            {/* Trust metrics */}
            <div className="mt-10 flex flex-wrap gap-6 border-t border-border pt-8">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <CurrencyDollarIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">0% Fees</p>
                  <p className="text-xs text-muted-foreground">No platform charges</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <ShieldCheckIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Verified</p>
                  <p className="text-xs text-muted-foreground">Every campaign audited</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <HeartIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Transparent</p>
                  <p className="text-xs text-muted-foreground">Full fund tracking</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Featured campaign card */}
          <div className="relative">
            {featuredCampaign ? (
              <Link
                href={`/campaigns/${featuredCampaign.slug}`}
                className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-all hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={featuredCampaign.heroImageUrl}
                    alt={`Campaign for ${featuredCampaign.subjectName}`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6 pt-16">
                    <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      Featured Campaign
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h2 className="font-display text-xl font-bold text-card-foreground">
                    {featuredCampaign.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Help {featuredCampaign.subjectName}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-lg font-bold text-primary">
                        {centsToDollars(featuredCampaign.raisedAmount)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        of {centsToDollars(featuredCampaign.goalAmount)}
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {percent}% funded
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/50">
                <p className="text-muted-foreground">No featured campaign yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
