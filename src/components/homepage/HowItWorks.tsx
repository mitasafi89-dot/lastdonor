import {
  MagnifyingGlassIcon,
  CreditCardIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';

const steps = [
  {
    number: '1',
    icon: MagnifyingGlassIcon,
    title: 'Choose a Campaign',
    description:
      'Browse verified fundraisers by category. Every campaign is audited by a real person before it goes live.',
  },
  {
    number: '2',
    icon: CreditCardIcon,
    title: 'Make Your Donation',
    description:
      'Give securely with 0% platform fees. Every cent of your donation goes directly to the person who needs it.',
  },
  {
    number: '3',
    icon: CheckBadgeIcon,
    title: 'See Your Impact',
    description:
      'Track where your money goes with milestone updates and proof of delivery. Full transparency, always.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Giving made simple
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Three steps from decision to real-world impact.
          </p>
        </div>

        <div className="relative mt-16">
          {/* Connecting line (desktop only) */}
          <div className="absolute left-0 right-0 top-16 hidden h-px border-t-2 border-dashed border-border lg:block" style={{ left: '16.67%', right: '16.67%' }} />

          <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col items-center text-center">
                {/* Number circle */}
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-md">
                  {step.number}
                </div>
                {/* Icon */}
                <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                {/* Content */}
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
