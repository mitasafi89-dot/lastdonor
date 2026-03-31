import Link from 'next/link';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export function TrustBanner() {
  return (
    <section className="bg-brand-teal py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="font-display text-lg font-bold text-white/90">
          Your trust comes first.
        </p>
        <p className="mt-6 max-w-3xl font-display text-3xl font-bold leading-snug text-white sm:text-4xl lg:text-5xl lg:leading-tight">
          Every campaign is{' '}
          <Link href="/how-it-works" className="underline decoration-white/50 underline-offset-4 hover:decoration-white">
            verified by a real person
          </Link>{' '}
          and tracked from start to finish. With 0% platform fees and{' '}
          <Link href="/transparency" className="underline decoration-white/50 underline-offset-4 hover:decoration-white">
            full fund tracking
          </Link>
          , you always know where your money ends up.
        </p>
        <div className="mt-10 flex items-center gap-2 text-white/80">
          <ShieldCheckIcon className="h-5 w-5" />
          <Link
            href="/how-it-works"
            className="text-sm font-medium underline underline-offset-4 hover:text-white"
          >
            Read the LastDonor Giving Guarantee
          </Link>
        </div>
      </div>
    </section>
  );
}
