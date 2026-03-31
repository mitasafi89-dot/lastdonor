'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';
import Link from 'next/link';

interface StatItemProps {
  value: number;
  label: string;
  prefix?: string;
}

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 50, damping: 20 });
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, motionValue, value]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        const formatted = Math.round(latest).toLocaleString('en-US');
        ref.current.textContent = `${prefix}${formatted}`;
      }
    });
    return unsubscribe;
  }, [springValue, prefix]);

  return (
    <span ref={ref} className="font-mono text-4xl font-bold text-primary sm:text-5xl">
      {prefix}0
    </span>
  );
}

function StatItem({ value, label, prefix }: StatItemProps) {
  return (
    <div className="text-center" aria-label={`${label}: ${prefix ?? ''}${value.toLocaleString('en-US')}`}>
      <AnimatedNumber value={value} prefix={prefix} />
      <p className="mt-2 text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

interface ImpactCounterProps {
  totalRaised: number;
  totalDonors: number;
  campaignsCompleted: number;
  peopleSupported: number;
}

export function ImpactCounter({
  totalRaised,
  totalDonors,
  campaignsCompleted,
  peopleSupported,
}: ImpactCounterProps) {
  // Convert cents to dollars for display
  const raisedDollars = Math.round(totalRaised / 100);

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <hr className="mb-12 border-border" />
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          What this community has done
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Real people donating to verified fundraisers with 0% platform fees.
          Every dollar is tracked from your wallet to their hands, because you
          deserve to see where your donation actually goes.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4">
          <StatItem value={raisedDollars} label="Raised So Far" prefix="$" />
          <StatItem value={totalDonors} label="People Who Gave" />
          <StatItem value={campaignsCompleted} label="Campaigns Funded" />
          <StatItem value={peopleSupported} label="Lives Changed" />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          We publish a full breakdown of every campaign&apos;s funds.{' '}
          <Link href="/transparency" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            See our transparency report
          </Link>
        </p>
      </div>
    </section>
  );
}
