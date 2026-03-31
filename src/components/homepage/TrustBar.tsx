import {
  CurrencyDollarIcon,
  ShieldCheckIcon,
  PhoneIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';

interface TrustBarProps {
  totalDonors: number;
}

const trustItems = [
  {
    icon: CurrencyDollarIcon,
    title: '0% Fees',
    description: 'Every cent goes to the cause',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Verified Campaigns',
    description: 'Human-audited before going live',
  },
  {
    icon: PhoneIcon,
    title: 'Real Support',
    description: 'Talk to a person, not a bot',
  },
];

export function TrustBar({ totalDonors }: TrustBarProps) {
  return (
    <section className="border-y border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
          {trustItems.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <HeartIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                <span className="font-mono">{totalDonors.toLocaleString('en-US')}</span> Donors
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">And counting every day</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
