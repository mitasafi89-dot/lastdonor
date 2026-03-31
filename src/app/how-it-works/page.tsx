import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import {
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'No hidden tips, no surprise fees. We find real people in crisis, verify their stories, and run campaigns until every dollar is raised. Here is exactly how it works.',
  openGraph: {
    title: 'How LastDonor.org Works',
    description:
      'We find verified stories, you donate with zero hidden fees, and we show you exactly where your money went.',
    images: [
      {
        url: '/api/v1/og/page?title=How+It+Works&subtitle=We+find+the+stories.+You+fund+them.+We+show+you+where+it+went.',
        width: 1200,
        height: 630,
        alt: 'How LastDonor.org Works',
      },
    ],
  },
};

const STEPS = [
  {
    number: '01',
    title: 'We Find Real People Who Need Help',
    description:
      'Our editorial team finds people facing genuine hardship through verified news sources, military outlets, emergency services, and local reporting. Every story is fact-checked and sourced. No fake campaigns. No unverified sob stories. If we can\'t confirm it, we don\'t run it.',
    icon: MagnifyingGlassIcon,
  },
  {
    number: '02',
    title: 'You Give What You Can',
    description:
      'Each campaign has a specific goal based on what the person actually needs. You choose your amount. There are no pre-selected tips, no hidden sliders, no "voluntary" fees tacked on at checkout. Every donation is publicly recorded (or anonymous if you prefer). When the goal is reached, the campaign closes.',
    icon: CurrencyDollarIcon,
  },
  {
    number: '03',
    title: 'You See Exactly Where It Went',
    description:
      'After a campaign is funded, we publish a full breakdown showing how the money was used. No black boxes. No "trust us." And the person who makes that final donation, the one that pushes the campaign over the finish line, earns a spot on our Last Donor Wall.',
    icon: EyeIcon,
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs />
      <h1 className="mt-6 font-display text-4xl font-bold text-foreground">
        How It Works
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Simple on purpose. No surprises at any step.
      </p>

      <div className="mt-12 space-y-12">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.number} className="flex gap-6">
              <div className="flex shrink-0 flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <span className="mt-2 font-mono text-sm font-bold text-primary">
                  {step.number}
                </span>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {step.title}
                </h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 rounded-xl bg-muted/30 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground">
          That&apos;s It. No Catches.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Find someone who needs help and be part of getting them there.
        </p>
        <Link
          href="/campaigns"
          className="mt-4 inline-flex rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Browse Campaigns
        </Link>
      </div>
    </div>
  );
}
