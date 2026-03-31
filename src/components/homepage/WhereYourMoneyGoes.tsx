import Link from 'next/link';

function DonutChart() {
  // 90% direct (teal), 10% processing (amber), 0% hidden
  // Circle: r=15.9155 gives circumference of ~100
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const directLen = circumference * 0.9;
  const processingLen = circumference * 0.1;
  const directOffset = 0;
  const processingOffset = -(directLen);

  return (
    <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64">
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
        {/* 90% Direct */}
        <circle
          cx="21"
          cy="21"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-primary"
          strokeDasharray={`${directLen} ${circumference - directLen}`}
          strokeDashoffset={directOffset}
          strokeLinecap="round"
        />
        {/* 10% Processing */}
        <circle
          cx="21"
          cy="21"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-brand-amber"
          strokeDasharray={`${processingLen} ${circumference - processingLen}`}
          strokeDashoffset={processingOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-bold text-foreground">90%</span>
        <span className="text-xs text-muted-foreground">goes directly</span>
      </div>
    </div>
  );
}

export function WhereYourMoneyGoes() {
  const items = [
    {
      label: 'Direct to the Person in Need',
      percent: 90,
      dotClass: 'bg-primary',
      description: 'Straight to the individual or family. No middlemen, no fund-locking, no delays.',
    },
    {
      label: 'Payment Processing & Hosting',
      percent: 10,
      dotClass: 'bg-brand-amber',
      description: 'Stripe processing, servers, and campaign verification costs.',
    },
    {
      label: 'Hidden Fees or Tips',
      percent: 0,
      dotClass: 'bg-muted-foreground',
      description: 'Zero. None. We will never sneak a tip onto your donation.',
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            90 Cents of Every Dollar Goes Directly to the Person in Need
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Most platforms add a 15% &quot;optional&quot; tip at checkout. We
            charge 0% platform fees. The only cost is payment processing.
          </p>
        </div>

        <div className="mt-14 grid items-center gap-12 md:grid-cols-2">
          <DonutChart />

          <div className="space-y-6">
            {items.map((item) => (
              <div key={item.label} className="flex gap-4">
                <span className={`mt-1.5 h-3 w-3 flex-shrink-0 rounded-full ${item.dotClass}`} />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-lg font-bold text-foreground">
                      {item.percent}%
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
            <Link
              href="/how-it-works"
              className="inline-flex rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              See how it works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
