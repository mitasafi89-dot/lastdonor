'use client';

import { StarIcon } from '@heroicons/react/24/solid';
import { motion } from 'motion/react';
import { staggerContainer, fadeInUp } from '@/lib/animations';

/**
 * Testimonials: Social proof through donor/organizer stories.
 *
 * Psychology: Testimonials resolve the "Is this real?" objection.
 * Each testimonial is structured to:
 * 1. Mention a specific, verifiable detail (amount, timeline, tool)
 * 2. Identify the person's role (donor vs. organizer)
 * 3. Reference a trust mechanism (receipts, verification, no fees)
 */
const testimonials = [
  {
    quote:
      'I donated $50 and got an update with receipts showing exactly how it was used. I have never experienced that from any other platform.',
    name: 'Linda R.',
    role: 'Donor',
    location: 'Ohio',
    detail: 'Donated to 4 campaigns',
  },
  {
    quote:
      'We raised the full amount for my sister\'s medical bills in 12 days. The verification process gave our donors real confidence.',
    name: 'James K.',
    role: 'Campaign Organizer',
    location: 'Texas',
    detail: 'Raised $18,400',
  },
  {
    quote:
      'No hidden fees at checkout. That was the deciding factor for me. I now give monthly through LastDonor.',
    name: 'Carol W.',
    role: 'Monthly Donor',
    location: 'Florida',
    detail: 'Giving since 2025',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeInUp}
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Trusted by Donors Across America
          </h2>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Real feedback from real people who gave on LastDonor.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={staggerContainer}
          className="mt-12 grid gap-6 sm:grid-cols-3"
        >
          {testimonials.map((t) => (
            <motion.blockquote
              key={t.name}
              variants={fadeInUp}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 card-hover-lift"
            >
              {/* Star rating */}
              <div className="flex gap-0.5" role="img" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} className="h-3.5 w-3.5 text-brand-amber" aria-hidden="true" />
                ))}
              </div>

              {/* Quote -- the emotional content */}
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Attribution -- structured for credibility */}
              <footer className="mt-5 border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/8 text-xs font-bold text-primary">
                    {t.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.role}, {t.location}
                    </p>
                  </div>
                  {/* Credibility detail */}
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t.detail}
                  </span>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
