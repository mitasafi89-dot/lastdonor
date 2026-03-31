import Link from 'next/link';

export function WhereYourMoneyGoes() {
  const items = [
    {
      label: 'Direct to the Person in Need',
      percent: 90,
      colorClass: 'bg-primary',
      description: 'Straight to the individual or family. No middlemen, no fund-locking, no delays.',
    },
    {
      label: 'Payment Processing & Hosting',
      percent: 10,
      colorClass: 'bg-brand-amber',
      description: 'Stripe processing, servers, and campaign verification costs. These are the only costs we pass through.',
    },
    {
      label: 'Hidden Fees or Tips',
      percent: 0,
      colorClass: 'bg-muted-foreground',
      description: 'Zero. None. We will never sneak a tip onto your donation.',
    },
  ];

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <hr className="mb-12 border-border" />
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Where your money actually goes
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Other platforms hide a 15% &quot;optional&quot; tip at checkout. We
              charge 0% platform fees because a fundraiser with no platform fees
              means more money reaches the people who need it.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Every campaign on LastDonor is document-verified by a real person.
              Funds are released in milestone-based phases
              tied to real evidence, so you always know your donation is going
              exactly where it was promised.
            </p>
            <Link
              href="/how-it-works"
              className="mt-6 inline-flex rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              See how it works
            </Link>
          </div>
          <div className="space-y-6">
            {items.map((item) => (
              <div key={item.label}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {item.label}
                  </span>
                  <span className="font-mono text-lg font-bold text-foreground">
                    {item.percent}%
                  </span>
                </div>
                <div
                  className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={item.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.label}: ${item.percent}%`}
                >
                  <div
                    className={`h-full rounded-full ${item.colorClass} transition-all duration-700`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
