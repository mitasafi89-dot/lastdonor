import Link from 'next/link';
import {
  HeartIcon,
  BoltIcon,
  FireIcon,
  GiftIcon,
  AcademicCapIcon,
  HomeIcon,
  UserGroupIcon,
  TrophyIcon,
  PaintBrushIcon,
  CalendarDaysIcon,
  BookOpenIcon,
  BriefcaseIcon,
  FlagIcon,
  GlobeAltIcon,
  HandRaisedIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import type { CampaignCategory } from '@/types';

function PawIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <circle cx="8.5" cy="5.5" r="1.8" />
      <circle cx="15.5" cy="5.5" r="1.8" />
      <circle cx="5.5" cy="10.5" r="1.8" />
      <circle cx="18.5" cy="10.5" r="1.8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 15.5c0-2.2 1.6-3.5 3.5-3.5s3.5 1.3 3.5 3.5c0 1.5-1.6 3-3.5 3s-3.5-1.5-3.5-3Z" />
    </svg>
  );
}

function LeafIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c0-6 3-11 8-13-2.5-.5-5 0-7 1.5C11 11 10.5 13 10 16l-5-3c1 4 3.5 6.5 7 8Z" />
      <path strokeLinecap="round" d="M10 16c-1-2-.5-5 1.5-7" />
    </svg>
  );
}

type CategoryItem = {
  slug: CampaignCategory;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const CATEGORIES: CategoryItem[] = [
  { slug: 'medical', label: 'Medical', icon: HeartIcon },
  { slug: 'memorial', label: 'Memorial', icon: FireIcon },
  { slug: 'emergency', label: 'Emergency', icon: BoltIcon },
  { slug: 'charity', label: 'Charity', icon: GiftIcon },
  { slug: 'education', label: 'Education', icon: AcademicCapIcon },
  { slug: 'animal', label: 'Animal', icon: PawIcon },
  { slug: 'environment', label: 'Environment', icon: LeafIcon },
  { slug: 'business', label: 'Business', icon: BriefcaseIcon },
  { slug: 'community', label: 'Community', icon: UserGroupIcon },
  { slug: 'competition', label: 'Competition', icon: TrophyIcon },
  { slug: 'creative', label: 'Creative', icon: PaintBrushIcon },
  { slug: 'event', label: 'Event', icon: CalendarDaysIcon },
  { slug: 'faith', label: 'Faith', icon: BookOpenIcon },
  { slug: 'family', label: 'Family', icon: HomeIcon },
  { slug: 'sports', label: 'Sports', icon: FlagIcon },
  { slug: 'travel', label: 'Travel', icon: GlobeAltIcon },
  { slug: 'volunteer', label: 'Volunteer', icon: HandRaisedIcon },
  { slug: 'wishes', label: 'Wishes', icon: StarIcon },
];

export function CategoryShowcase() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Browse fundraisers by category
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              People around the world are raising money for what they are passionate about.
            </p>
            <Link
              href="/share-your-story"
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start a Campaign
            </Link>
          </div>
        </div>

        <ul className="mt-12 grid list-none grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] gap-10 p-0">
          {CATEGORIES.map(({ slug, label, icon: Icon }) => (
            <li key={slug}>
              <Link
                href={`/campaigns?category=${slug}`}
                className="group flex flex-col items-center gap-2 text-foreground transition-colors hover:text-primary"
              >
                <span className="flex h-24 w-full items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-muted/70">
                  <Icon className="h-12 w-12" />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
