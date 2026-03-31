'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';
import Link from 'next/link';

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
    <span ref={ref} className="font-mono text-5xl font-bold text-white sm:text-6xl">
      {prefix}0
    </span>
  );
}

function StatItem({ value, label, prefix }: { value: number; label: string; prefix?: string }) {
  return (
    <div className="text-center" aria-label={`${label}: ${prefix ?? ''}${value.toLocaleString('en-US')}`}>
      <AnimatedNumber value={value} prefix={prefix} />
      <p className="mt-2 text-sm font-medium text-white/70">{label}</p>
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
  const raisedDollars = Math.round(totalRaised / 100);

  return (
    <section className="relative overflow-hidden bg-primary py-20 sm:py-24">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          What this community has done
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base text-white/70">
          Real people donating to verified fundraisers with 0% platform fees.
          Every dollar tracked from your wallet to their hands.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <StatItem value={raisedDollars} label="Raised So Far" prefix="$" />
          <StatItem value={totalDonors} label="People Who Gave" />
          <StatItem value={campaignsCompleted} label="Campaigns Funded" />
          <StatItem value={peopleSupported} label="Lives Changed" />
        </div>
        <p className="mt-10 text-center text-sm text-white/60">
          We publish a full breakdown of every campaign&apos;s funds.{' '}
          <Link
            href="/transparency"
            className="font-medium text-white underline underline-offset-4 hover:text-white/80"
          >
            See our transparency report
          </Link>
        </p>
      </div>
    </section>
  );
}
