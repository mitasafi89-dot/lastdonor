import Image from 'next/image';
import Link from 'next/link';
import { centsToDollars } from '@/lib/utils/currency';

interface FeaturedCampaign {
  slug: string;
  title: string;
  heroImageUrl: string;
  subjectName: string;
  raisedAmount: number;
  goalAmount: number;
}

interface HeroSectionProps {
  featuredCampaign: FeaturedCampaign | null;
}

export function HeroSection({ featuredCampaign }: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[540px] items-center overflow-hidden bg-background md:min-h-[620px]">
      {/* Background image from featured campaign */}
      {featuredCampaign && (
        <div className="absolute inset-0">
          <Image
            src={featuredCampaign.heroImageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
        </div>
      )}

      {/* Fallback gradient when no featured campaign */}
      {!featuredCampaign && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            You Know Exactly Where Your Money Goes
          </h1>
          <p className="mt-4 text-lg text-white/80 sm:text-xl">
            No hidden tips. No surprise fees. No AI chatbot runaround. Just
            verified campaigns for real people, with every dollar tracked from
            your wallet to their hands.
          </p>

          {featuredCampaign && (
            <p className="mt-3 text-sm text-white/60">
              Featured: Help {featuredCampaign.subjectName} —{' '}
              {centsToDollars(featuredCampaign.raisedAmount)} of{' '}
              {centsToDollars(featuredCampaign.goalAmount)} raised
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/campaigns"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Browse Campaigns
            </Link>
            <Link
              href="/share-your-story"
              className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Start a Campaign
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
