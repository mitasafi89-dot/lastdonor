import Link from 'next/link';
import {
  ShieldCheckIcon,
  EyeIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

const trustPoints = [
  {
    icon: ShieldCheckIcon,
    title: 'Verified by a real person',
    description:
      'Every campaign is document-verified by a real reviewer before a single dollar is raised.',
  },
  {
    icon: EyeIcon,
    title: 'Full fund tracking',
    description:
      'See exactly where every donation goes with milestone-based releases.',
  },
  {
    icon: CurrencyDollarIcon,
    title: '0% platform fees',
    description:
      'No hidden tips, no surprise charges at checkout. More of your donation reaches the person who needs it.',
  },
];

export function TrustBanner() {
  return (
    <section className="bg-primary py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Built on Trust. Backed by Proof.
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {trustPoints.map((point) => (
            <div key={point.title} className="text-center">
              <point.icon className="mx-auto h-8 w-8 text-white/80" />
              <h3 className="mt-4 font-display text-lg font-bold text-white">
                {point.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {point.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/campaigns"
            className="inline-flex rounded-full bg-brand-amber px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-brand-amber/90 hover:shadow-xl"
          >
            Start giving today
          </Link>
          <p className="mt-4 text-sm text-white/60">
            <Link
              href="/how-it-works"
              className="font-medium text-white/80 underline underline-offset-4 hover:text-white"
            >
              Read the LastDonor Giving Guarantee
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
