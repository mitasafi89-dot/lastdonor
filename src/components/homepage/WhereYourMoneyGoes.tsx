'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { fadeInUp, staggerContainer } from '@/lib/animations';

/**
 * Donut chart: visual proof of fund allocation.
 * 90% direct, 10% processing, 0% hidden.
 * The "90%" number in the center is THE focal point.
 */
function DonutChart() {
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const directLen = circumference * 0.9;
  const processingLen = circumference * 0.1;
  const processingOffset = -(directLen);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative mx-auto h-[280px] w-[280px] sm:h-[340px] sm:w-[340px]"
    >
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
        {/* 90% Direct */}
        <motion.circle
          cx="21" cy="21" r={radius} fill="none" strokeWidth="6"
          className="stroke-primary"
          strokeLinecap="butt"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          whileInView={{ strokeDasharray: `${directLen} ${circumference - directLen}` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
        />
        {/* 10% Processing */}
        <motion.circle
          cx="21" cy="21" r={radius} fill="none" strokeWidth="6"
          className="stroke-brand-amber"
          strokeLinecap="butt"
          strokeDashoffset={processingOffset}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          whileInView={{ strokeDasharray: `${processingLen} ${circumference - processingLen}` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 1 }}
        />
      </svg>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="absolute inset-0 flex flex-col items-center justify-center pt-2"
      >
        <span className="font-sans text-[4.5rem] font-bold leading-none tracking-tighter text-foreground sm:text-[5.5rem]">90%</span>
        <span className="text-[17px] font-medium tracking-tight text-foreground">goes directly</span>
      </motion.div>
    </motion.div>
  );
}

/**
 * WhereYourMoneyGoes: Fund allocation transparency.
 *
 * Psychology: The #1 donor objection is "Will they take a cut?"
 * This section answers it with visual evidence (donut chart)
 * and explicit comparison to competitors.
 * The 0% line is the most important -- it directly contrasts
 * with GoFundMe's hidden 15% tip.
 */
export function WhereYourMoneyGoes() {
  const items = [
    {
      label: 'Direct to the Person in Need',
      percent: 90,
      dotClass: 'bg-primary',
      description: 'Straight to the individual or family. No middlemen, no delays.',
    },
    {
      label: 'Payment Processing',
      percent: 10,
      dotClass: 'bg-brand-amber',
      description: 'Stripe\u2019s standard processing fee (2.9% + $0.30 per transaction). LastDonor receives none of this.',
    },
    {
      label: 'Hidden Fees or Tips.',
      percent: 0,
      dotClass: 'bg-[#D1D5DB]',
      description: 'Zero. We will never sneak a tip onto your donation at checkout.',
    },
  ];

  return (
    <section className="py-20 sm:py-24 bg-surface-amber">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Header centered */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeInUp}
          className="mx-auto max-w-3xl text-center mb-16 sm:mb-24"
        >
          <h2 className="font-display text-[2.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[3.25rem]">
            At Least 90 Cents of Every Dollar Goes Directly<br className="hidden md:block" /> to the Person in Need
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-[17px] leading-relaxed text-foreground">
            LastDonor charges 0% platform fees. The only deduction is Stripe&rsquo;s standard payment processing fee (2.9% + $0.30 per transaction).<br className="hidden md:block" />
            No tip prompts, no platform cut, no hidden charges.
          </p>
        </motion.div>

        <div className="grid items-center gap-16 md:grid-cols-2 md:gap-8 lg:gap-24">
          {/* Left: breakdown list */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            className="flex flex-col"
          >
            {/* Breakdown items */}
            <motion.div variants={staggerContainer} className="space-y-12">
              {items.map((item) => (
                <motion.div key={item.label} variants={fadeInUp} className="flex flex-row items-stretch gap-6 sm:gap-10">
                  <div className="w-[85px] sm:w-[120px] shrink-0 text-right">
                    <span className="font-sans text-[3.5rem] font-bold leading-[0.8] tracking-tighter text-foreground sm:text-[4.5rem]">
                      {item.percent}%
                    </span>
                  </div>
                  <div className="flex flex-1 items-start gap-3">
                    <span className={`mt-1.5 block h-3.5 w-3.5 shrink-0 rounded-full ${item.dotClass}`} />
                    <div>
                      <h3 className="font-sans text-xl font-bold tracking-tight text-foreground leading-[1.2]">
                        {item.label}
                      </h3>
                      <p className="mt-1.5 text-base leading-[1.3] text-foreground max-w-[280px]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={fadeInUp} className="mt-12 pl-[109px] sm:pl-[160px]">
              <Link
                href="/how-it-works"
                className="btn-press inline-flex rounded-full border-[1.5px] border-primary px-8 py-3.5 font-sans text-[15px] font-bold text-primary transition-all duration-200 hover:bg-primary/5 hover:-translate-y-0.5"
              >
                See the full breakdown
              </Link>
            </motion.div>
          </motion.div>

          {/* Right: donut chart */}
          <div className="flex justify-center md:justify-end">
            <DonutChart />
          </div>
        </div>
      </div>
    </section>
  );
}
