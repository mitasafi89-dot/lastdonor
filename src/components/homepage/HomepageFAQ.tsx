import { ChevronDownIcon } from '@heroicons/react/24/outline';

const faqs = [
  {
    question: 'Does LastDonor charge platform fees?',
    answer:
      'No. LastDonor charges 0% platform fees. The only deduction is the standard payment processing fee (approximately 2.9% + 30 cents) charged by Stripe. Every cent of your platform donation reaches the person in need.',
  },
  {
    question: 'How does LastDonor verify campaigns?',
    answer:
      'Every campaign is reviewed by a real human before going live. We require documentation such as medical records, bills, official letters, or photos to verify the situation is genuine. Campaigns that do not meet our standards are rejected and listed publicly on our Rejected Campaigns page.',
  },
  {
    question: 'Where does my donation money go?',
    answer:
      'LastDonor charges 0% platform fees. At least 90% of every donation reaches the verified individual or family directly. The only deduction is Stripe\u2019s standard payment processing fee (2.9% + $0.30 per transaction), which goes entirely to Stripe. There are no hidden tips, no platform cuts, and no surprise charges at checkout. You receive impact updates with photos and receipts.',
  },
  {
    question: 'What types of fundraisers can I support?',
    answer:
      'LastDonor supports verified campaigns for medical bills, emergencies, memorial funds, military and veteran families, first responders, education, disaster relief, community needs, and family crises.',
  },
  {
    question: 'How is LastDonor different from GoFundMe?',
    answer:
      "LastDonor charges 0% platform fees and has no tip mechanism at checkout. Every campaign is human-verified before going live. LastDonor is a registered 501(c)(3) nonprofit. Donors receive verified receipts and impact updates showing exactly how their donation was used.",
  },
  {
    question: 'Can I donate without creating an account?',
    answer:
      'Yes. You can donate as a guest without creating an account. No signup is required to browse campaigns or donate. You will receive an email receipt confirming your contribution.',
  },
];

export function HomepageFAQ() {
  return (
    <section className="bg-background py-20 sm:py-24" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2
            id="faq-heading"
            className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Everything you need to know before you give.
          </p>
        </div>

        <dl className="mt-12 divide-y divide-border">
          {faqs.map((faq) => (
            // open attribute renders all answers visible in the initial DOM.
            // Google's documentation states content hidden in collapsed <details>
            // is treated as lower-priority content. FAQPage JSON-LD schema must
            // align with visible DOM content to be eligible for FAQ Rich Results.
            // The CSS group-open:rotate-180 chevron still provides visual toggle.
            <details key={faq.question} open className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left">
                <dt className="text-base font-semibold text-foreground">{faq.question}</dt>
                <ChevronDownIcon
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <dd className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}
