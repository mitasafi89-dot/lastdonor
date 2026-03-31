import { centsToDollars } from '@/lib/utils/currency';

interface TrustBarProps {
  totalDonors: number;
}

export function TrustBar({ totalDonors }: TrustBarProps) {
  return (
    <section className="border-y border-border bg-primary/5">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-foreground sm:text-base">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-green" />
            0% Platform Fees
          </span>
          <span className="mx-3 text-muted-foreground" aria-hidden="true">·</span>
          <span>Every Campaign Verified</span>
          <span className="mx-3 text-muted-foreground" aria-hidden="true">·</span>
          <span>Real Human Support</span>
          <span className="mx-3 text-muted-foreground" aria-hidden="true">·</span>
          <span className="font-mono">
            {totalDonors.toLocaleString('en-US')}
          </span>{' '}
          donors and counting
        </p>
      </div>
    </section>
  );
}
