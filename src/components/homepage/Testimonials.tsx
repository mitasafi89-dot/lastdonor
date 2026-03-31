import { StarIcon } from '@heroicons/react/24/solid';

const testimonials = [
  {
    quote:
      'I was skeptical at first, but LastDonor showed me exactly where my $50 went. I could see the receipts, the updates, everything.',
    name: 'Sarah M.',
    role: 'Donor',
  },
  {
    quote:
      'We raised the full amount in 12 days. The verification process gave our donors confidence that this was real.',
    name: 'James K.',
    role: 'Campaign Organizer',
  },
  {
    quote:
      'No hidden fees was the main reason I chose LastDonor. Every other platform tried to sneak in a tip at checkout.',
    name: 'Priya D.',
    role: 'Recurring Donor',
  },
];

export function Testimonials() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          What people are saying
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
