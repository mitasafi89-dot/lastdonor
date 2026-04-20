'use client';

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
import { motion } from 'motion/react';
import { staggerContainer, fadeInUp } from '@/lib/animations';
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
    <section className="py-20 sm:py-24 bg-surface-teal">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeInUp}
        >
          <h2 className="font-display text-[2rem] font-bold tracking-tight text-foreground md:text-[2.25rem]">
            Find a Cause You Care About
          </h2>
          <p className="mt-4 max-w-2xl font-serif text-[15px] font-light text-muted-foreground/80 md:text-[16px]">
            Browse verified campaigns by category and give where it matters most.
          </p>
        </motion.div>

        {/* Grid on desktop, horizontal scroll on mobile */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={staggerContainer}
          className="mt-14 flex gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0 lg:gap-6"
        >
          {TOP_CATEGORIES.map(({ slug, label, icon: Icon }) => (
            <motion.div key={slug} variants={fadeInUp}>
              <Link
                href={`/campaigns/category/${slug}`}
                className="group flex min-w-[8rem] flex-col items-center justify-center gap-5 rounded-[1.25rem] border-[1px] border-border/60 bg-white py-9 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] sm:min-w-0"
              >
                <span className="flex h-[56px] w-[56px] items-center justify-center rounded-[1rem] bg-muted">
                  <Icon className="h-[26px] w-[26px] text-muted-foreground" strokeWidth={1.5} />
                </span>
                <span className="font-serif text-[14.5px] font-medium tracking-wide text-foreground/90">{label}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-20px' }}
          variants={fadeInUp}
          className="mt-12"
        >
          <Link
            href="/campaigns"
            className="btn-press inline-flex items-center justify-center rounded-full border-[1px] border-border/80 px-7 py-3 font-serif text-[14.5px] font-bold text-foreground transition-all duration-200 hover:bg-muted/50 hover:-translate-y-0.5"
          >
            View all categories
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
