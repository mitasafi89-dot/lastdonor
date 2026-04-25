'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { fadeInUp, staggerContainer } from '@/lib/animations';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-muted" aria-label="Welcome">
      {/* Desktop hero image - right portion, fades into background */}
      <div
        className="absolute inset-y-0 right-0 hidden w-[55%] lg:block"
      >
        <Image
          src="/images/hero-bg.webp"
          alt="LastDonor.org reviewed crowdfunding platform showing donation support and campaign progress"
          fill
          priority
          sizes="55vw"
          className="object-cover object-center"
        />
        {/* Gradient fade - blends image seamlessly into background */}
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/50 to-transparent" />
      </div>

      {/* Mobile hero image - stacked above text */}
      <div
        className="relative aspect-[16/9] sm:aspect-[2/1] lg:hidden"
      >
        <Image
          src="/images/hero-bg.webp"
          alt="LastDonor.org reviewed crowdfunding platform showing donation support and campaign progress"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-muted via-muted/40 to-transparent" />
      </div>

      {/* Text content - left column on desktop, full-width on mobile */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="py-12 sm:py-16 lg:w-1/2 lg:py-28 xl:py-32"
        >
          <h1 className="hero-h1 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
            <span className="block">LastDonor</span>
            Verified crowdfunding with{' '}
            <span className="text-primary">0% platform fees</span>{' '}
            and visible impact.
          </h1>

          <motion.p
            variants={fadeInUp}
            className="hero-summary mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
          >
            Support real people through medical, emergency, and disaster relief fundraising campaigns that are reviewed before publication. Follow campaign progress, fund releases, and impact updates from donation to outcome.
          </motion.p>

          {/* CTAs - primary (amber) + secondary (teal outlined) */}
          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/campaigns"
              className="btn-press inline-flex items-center justify-center rounded-full bg-brand-amber px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:shadow-[--shadow-amber] hover:-translate-y-0.5"
            >
              Browse Reviewed Campaigns
            </Link>
            <Link
              href="/share-your-story"
              className="btn-press inline-flex items-center justify-center rounded-full border-2 border-primary px-8 py-3.5 text-sm font-semibold text-primary transition-all duration-200 hover:bg-primary/5 hover:-translate-y-0.5"
            >
              Share Your Story
            </Link>
          </motion.div>

          {/* Zero-Knowledge Proof strip: pre-empts top FUDs at point of CTA click */}
          <motion.p
            variants={fadeInUp}
            className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
          >
            <CheckBadgeIcon className="h-4 w-4 text-brand-teal" aria-hidden="true" />
            <span>No signup required to donate</span>
            <span aria-hidden="true" className="text-border">·</span>
            <span>Every campaign human-reviewed</span>
            <span aria-hidden="true" className="text-border">·</span>
            <span>0% platform fees</span>
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
