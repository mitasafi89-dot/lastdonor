import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Editorial Standards',
  description:
    'How we verify every campaign on LastDonor. No fake stories, no unverified claims. Here is exactly how our editorial process works.',
  openGraph: {
    title: 'Editorial Standards | LastDonor.org',
    description:
      'Every campaign is verified by a real person. Here is how our editorial process works.',
    images: [
      {
        url: '/api/v1/og/page?title=Editorial+Standards&subtitle=Every+campaign+is+verified+by+a+real+person.',
        width: 1200,
        height: 630,
        alt: 'Editorial Standards at LastDonor.org',
      },
    ],
  },
};

export default function EditorialStandardsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs />
      <h1 className="mt-6 font-display text-4xl font-bold text-foreground">
        Editorial Standards
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Fake campaigns are a real problem on crowdfunding platforms. People
        fabricate illnesses, exploit disasters, and steal identities to collect
        money they don&apos;t deserve. We refuse to let that happen here.
        Here&apos;s how we keep it out.
      </p>

      <div className="mt-10 space-y-8 text-foreground">
        <section>
          <h2 className="font-display text-2xl font-bold">
            Source Requirements
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Every campaign needs at least one credible, independently
            verifiable source before we will publish it. We don&apos;t take
            anyone&apos;s word for it. We check. Acceptable sources include:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Official military and defense publications (DVIDS, Stars &amp; Stripes, Defense.gov)</li>
            <li>Law enforcement and fire service official reports (ODMP, USFA, LODD databases)</li>
            <li>Government disaster declarations (FEMA, NWS)</li>
            <li>Established news organizations with editorial oversight</li>
            <li>Hospital or medical facility confirmations</li>
            <li>Court records, GoFundMe pages (as supplementary evidence only)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold">
            How We Verify Each Campaign
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>We find the story</strong> — Through news feeds,
              official reports, and community submissions. We go looking for
              people who actually need help.
            </li>
            <li>
              <strong>We check the sources</strong> — At least one primary
              source has to be independently verifiable. We cross-reference
              with multiple sources whenever we can.
            </li>
            <li>
              <strong>We confirm the need</strong> — We verify that the
              person or family has a real financial need, and that a specific
              dollar amount is justified and not inflated.
            </li>
            <li>
              <strong>A real person reviews it</strong> — A member of our
              editorial team reads the campaign for accuracy, tone, and
              completeness. Not an algorithm. A person.
            </li>
            <li>
              <strong>It goes live with citations</strong> — Every published
              campaign includes source citations so you can verify the story
              yourself if you want to.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold">
            What We Will Never Do
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>We will never fabricate or embellish a story to get more donations.</li>
            <li>
              We will never use guilt-based language, manipulative appeals, or
              sensationalized headlines.
            </li>
            <li>
              We will never run campaigns for celebrities, politicians, or
              anyone who is not in genuine financial need.
            </li>
            <li>
              We will never publish photos of identifiable people without
              proper sourcing. Campaign images are editorial illustrations
              unless sourced from official public domain outlets.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold">
            When We Get Something Wrong
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If we discover an error in a campaign, here is what happens:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-muted-foreground">
            <li>
              We fix it immediately and note the correction on the campaign
              page so everyone can see what changed.
            </li>
            <li>
              If the error is serious (wrong person, incorrect incident), we
              pause the campaign, contact every donor who gave, and publish a
              transparent correction.
            </li>
            <li>
              If a campaign turns out to be based on false information, we
              suspend it, refund every donor, and publish a full explanation.
              No excuses.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold">
            See Something Off? Tell Us.
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If you think any information on our platform is wrong, email us at{' '}
            <a
              href="mailto:editorial@lastdonor.org"
              className="text-primary underline underline-offset-4"
            >
              editorial@lastdonor.org
            </a>
            . We take every report seriously and a real person will look into it
            within 24 hours.
          </p>
        </section>
      </div>
    </div>
  );
}
