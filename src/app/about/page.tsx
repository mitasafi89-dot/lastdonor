import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = {
  title: 'About',
  description:
    'LastDonor.org is crowdfunding built on trust. No hidden tips, no AI chatbot runaround, no surprise fees. Every campaign is verified by a real person and tracked with full transparency.',
  openGraph: {
    title: 'About LastDonor.org',
    description:
      'Crowdfunding built on trust. No hidden tips, no surprise fees. Every campaign verified by real people.',
    images: [
      {
        url: '/api/v1/og/page?title=About+LastDonor.org&subtitle=Crowdfunding+built+on+trust.+No+hidden+tips%2C+no+surprise+fees.',
        width: 1200,
        height: 630,
        alt: 'About LastDonor.org',
      },
    ],
  },
};

export default function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'LastDonor.org',
    url: 'https://lastdonor.org',
    description:
      'Crowdfunding built on trust. Every campaign is verified, every dollar is tracked, and there are zero hidden fees.',
    foundingDate: '2024',
    nonprofitStatus: '501(c)(3)',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs />
        <h1 className="mt-6 font-display text-4xl font-bold text-foreground">
          About LastDonor.org
        </h1>

        <section className="mt-8 space-y-6 text-foreground">
          <h2 className="font-display text-2xl font-bold">Why We Exist</h2>
          <p className="text-muted-foreground leading-relaxed">
            Most crowdfunding platforms sneak a 15% &quot;optional&quot; tip onto
            your donation at checkout. They lock campaigners out of their own
            funds for weeks. When something goes wrong, you get an AI chatbot
            that talks in circles. We got tired of watching that happen.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            LastDonor.org was built to do things differently. We find people in
            real crisis, verify their stories with our editorial team, and run
            focused campaigns until every dollar of the goal is raised. No hidden
            fees. No dark patterns. No games. When the last dollar comes in, the
            person who gave it earns the title of <strong>Last Donor</strong>,
            and the campaign is done.
          </p>

          <h2 className="font-display text-2xl font-bold">
            What Makes Us Different
          </h2>
          <ul className="list-disc space-y-3 pl-6 text-muted-foreground">
            <li>
              <strong>Every campaign is verified by a real person</strong> — Not
              an algorithm. Our editorial team researches each story, checks
              documentation, and cites sources. Donors can give with confidence.
            </li>
            <li>
              <strong>Zero hidden fees, zero tip sliders</strong> — We will
              never sneak a &quot;voluntary tip&quot; onto your donation. 90%
              goes directly to the person in need. 10% covers payment
              processing, hosting, and verification. That&apos;s it.
            </li>
            <li>
              <strong>You can track every dollar</strong> — Every donation is
              publicly recorded. You can see who gave, how much was raised, and
              when the campaign was completed. Full receipts, always.
            </li>
            <li>
              <strong>Real human support</strong> — If something goes wrong, you
              talk to a person. Not a chatbot. Not a form that sends you in
              circles. An actual human being who can actually help.
            </li>
            <li>
              <strong>Campaigns have an endpoint</strong> — We don&apos;t run
              open-ended fundraisers that drag on forever. Each campaign has a
              specific goal and closes when it&apos;s met.
            </li>
          </ul>

          <h2 className="font-display text-2xl font-bold">
            Who We Help
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Military families. Veterans. First responders. Parents facing
            impossible medical bills. Families picking up the pieces after a
            disaster. Students who can&apos;t afford tuition. People whose pets
            need surgery they can&apos;t pay for. Communities trying to rebuild.
            If the need is real and we can verify it, we&apos;ll fight to get it
            funded.
          </p>

          <h2 className="font-display text-2xl font-bold">Our Team</h2>
          <p className="text-muted-foreground leading-relaxed">
            We&apos;re a small team of technologists, journalists, and nonprofit
            operators. Our editorial standards match professional newsrooms
            because that&apos;s where several of us came from. We care about
            getting things right more than getting things fast.
          </p>

          <h2 className="font-display text-2xl font-bold">
            501(c)(3) Status
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            LastDonor.org is a registered 501(c)(3) nonprofit organization. All
            donations are tax-deductible to the extent allowed by law. We
            publish our financials because we believe the platforms asking for
            your money should be just as transparent as the campaigns they host.
          </p>
        </section>
      </div>
    </>
  );
}
