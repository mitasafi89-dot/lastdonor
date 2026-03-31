import Image from 'next/image';
import Link from 'next/link';
import type { CategoryContent } from '@/lib/category-content';

interface CategoryHeroSectionProps {
  content: CategoryContent;
}

export function CategoryHeroSection({ content }: CategoryHeroSectionProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-12 md:py-16 lg:px-8">
        {/* Left: text content */}
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-[1.15]">
            Discover {content.label.toLowerCase()} fundraisers
            <br className="hidden sm:block" />
            {' '}on LastDonor
          </h1>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            {content.intro}
          </p>

          <Link
            href="/share-your-story"
            className="mt-6 inline-flex rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start a Campaign
          </Link>
        </div>

        {/* Right: hero image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl sm:aspect-[16/10]">
          <Image
            src={content.heroImageUrl}
            alt={content.heroImageAlt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />

        </div>
      </div>
    </section>
  );
}
