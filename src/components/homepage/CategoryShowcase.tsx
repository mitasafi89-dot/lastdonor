import Link from 'next/link';
import {
  HeartIcon,
  BoltIcon,
  FireIcon,
  GiftIcon,
  AcademicCapIcon,
  HomeIcon,
  UserGroupIcon,
  BriefcaseIcon,
  BookOpenIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import type { CampaignCategory } from '@/types';

type CategoryItem = {
  slug: CampaignCategory;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const TOP_CATEGORIES: CategoryItem[] = [
  { slug: 'medical', label: 'Medical', icon: HeartIcon },
  { slug: 'emergency', label: 'Emergency', icon: BoltIcon },
  { slug: 'memorial', label: 'Memorial', icon: FireIcon },
  { slug: 'charity', label: 'Charity', icon: GiftIcon },
  { slug: 'education', label: 'Education', icon: AcademicCapIcon },
  { slug: 'family', label: 'Family', icon: HomeIcon },
  { slug: 'community', label: 'Community', icon: UserGroupIcon },
  { slug: 'business', label: 'Business', icon: BriefcaseIcon },
  { slug: 'faith', label: 'Faith', icon: BookOpenIcon },
  { slug: 'travel', label: 'Travel', icon: GlobeAltIcon },
];

export function CategoryShowcase() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Find a Cause You Care About
          </h2>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Medical bills, emergencies, education, community needs. Browse
            verified campaigns by category and give where it matters most to you.
          </p>
        </div>

        {/* Horizontal scroll on mobile, wrapped grid on desktop */}
        <div className="mt-10 flex gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0 lg:gap-6">
          {TOP_CATEGORIES.map(({ slug, label, icon: Icon }) => (
            <Link
              key={slug}
              href={`/campaigns?category=${slug}`}
              className="group flex min-w-[7rem] flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md sm:min-w-0"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Icon className="h-7 w-7 text-primary" />
              </span>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/campaigns"
            className="inline-flex rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            View all categories
          </Link>
        </div>
      </div>
    </section>
  );
}
