'use client';

import Link from 'next/link';
import {
  ShieldCheckIcon,
  EyeIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'motion/react';
import { staggerContainer, fadeInUp } from '@/lib/animations';

/**
 * TrustBanner: Final-CTA section combining proof + action.
 *
 * Psychology: By this point in the page scroll, the user has seen
 * campaigns, impact numbers, and testimonials. This section resolves
 * any remaining hesitation with structural proof (HOW trust works)
 * and a clear, dominant call-to-action.
 *
 * Each card answers a specific objection:
 * 1. "How do I know campaigns are reviewed?" -> Reviewed by a person
 * 2. "What happens to my money?" -> Impact updates
 * 3. "Will they charge a platform fee?" -> 0% platform fees on fundraisers
 */
const trustProofs = [
  {
    icon: ShieldCheckIcon,
    title: 'Reviewed by a person',
    proof: 'Campaigns are reviewed before publication for clarity, category fit, goal amount, beneficiary details, and supporting context.',
  },
  {
    icon: EyeIcon,
    title: 'Impact updates after funding',
    proof: 'Campaign pages and stories can include photos, receipts, notes, and outcome updates after a fundraiser receives support.',
  },
  {
    icon: CurrencyDollarIcon,
    title: '0% platform fees on fundraisers',
    proof: 'LastDonor operations are funded separately through general fund donations, grants, sponsorships, and operating support.',
  },
];

export function TrustBanner() {
  return (
    <section className="relative overflow-hidden bg-primary py-20 sm:py-24">
      {/* Subtle texture -- grid lines for structured/fintech feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={staggerContainer}
        className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <motion.div variants={fadeInUp} className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built on Proof, Not Promises
          </h2>
          <p className="mt-3 text-base text-white/80">
            We designed every part of this platform to answer one question:
            &ldquo;Can I understand this fundraiser before I give?&rdquo;
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {trustProofs.map((proof) => (
            <motion.div
              key={proof.title}
              variants={fadeInUp}
              className="group rounded-2xl bg-white/[0.06] p-6 backdrop-blur-sm transition-colors duration-200 hover:bg-white/[0.10]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <proof.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">
                {proof.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {proof.proof}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Dominant CTA */}
        <motion.div variants={fadeInUp} className="mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link
            href="/campaigns"
            className="btn-press inline-flex rounded-full bg-brand-amber px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[--shadow-amber]"
          >
            Browse Reviewed Campaigns
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-white"
          >
            See how it works
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
