import { StarIcon } from '@heroicons/react/24/solid';

const testimonials = [
  {
    quote:
      'I donated $50 and got an update with receipts showing exactly how it was used. I have never experienced that from any other platform.',
    name: 'Linda R.',
    role: 'Donor, Ohio',
  },
  {
    quote:
      'We raised the full amount for my sister\'s medical bills in 12 days. The verification process gave our donors real confidence.',
    name: 'James K.',
    role: 'Campaign Organizer, Texas',
  },
  {
    quote:
      'No hidden fees at checkout. That was the deciding factor for me. I now give monthly through LastDonor.',
    name: 'Carol W.',
    role: 'Monthly Donor, Florida',
  },
];

export function Testimonials() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Trusted by Donors Across America
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote
              key={t.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex gap-0.5 text-brand-amber" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} className="h-4 w-4" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
