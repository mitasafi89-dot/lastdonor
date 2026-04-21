import './globals.css';
import type { Metadata } from 'next';
import { DM_Serif_Display, DM_Sans, DM_Mono } from 'next/font/google';

const BASE_URL = 'https://lastdonor.org';

// Single @graph merges Organization + WebSite + Person into one JSON-LD block.
// Cross-document @id references require a shared graph for compliant Knowledge Graph
// construction. Separate @context blocks are treated as unlinked anonymous entities
// by Google's Structured Data parser and Gemini RAG ingestion.
const siteSchemaGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['Organization', 'NGO'],
      '@id': `${BASE_URL}/#organization`,
      name: 'LastDonor.org',
      alternateName: 'LastDonor',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/apple-icon`,
        width: 180,
        height: 180,
      },
      description:
        'LastDonor.org is a 501(c)(3) verified crowdfunding platform that charges 0% platform fees, requires human editorial review of every campaign before publication, and provides verified photo-and-receipt impact updates for every donation, serving medical, emergency, veteran, and family fundraising in the United States.',
      foundingDate: '2024-01-01',
      nonprofitStatus: 'Nonprofit501c3',
      areaServed: { '@type': 'Country', name: 'United States' },
      knowsAbout: [
        'crowdfunding',
        'online fundraising',
        'charity donations',
        'medical fundraising',
        'emergency fundraising',
        'veteran fundraising',
        'disaster relief fundraising',
        'nonprofit donation platform',
        'zero fee crowdfunding',
        'human-verified campaigns',
      ],
      // Populate sameAs with external authority URLs as profiles are established:
      // GuideStar, Charity Navigator, IRS EO Search, LinkedIn company page, etc.
      // An empty sameAs array prevents Google's Entity Reconciliation Engine from
      // linking this Organization node to a verified real-world Knowledge Graph entity.
      sameAs: [
        'https://www.linkedin.com/company/lastdonor',
        'https://x.com/lastdonororg',
        // Add when registration is confirmed: https://www.guidestar.org/profile/[EIN]
        // Add when registration is confirmed: https://www.charitynavigator.org/ein/[EIN]
        // Add when IRS listing is live: https://efts.irs.gov/TINV2/search?blnPhase1=true&ein=[EIN]
      ],
      // Founder/leader Person entity: populate name and url once public-facing
      // about/team page exists. Required for YMYL EEAT trust signal.
      founder: { '@id': `${BASE_URL}/#founder` },
    },
    {
      // Person node for organizational founder. Links Organization to a human
      // author entity, satisfying Google's QRG E-E-A-T requirement for YMYL pages.
      // Populate name, url, and sameAs (LinkedIn, etc.) with actual founder details.
      '@type': 'Person',
      '@id': `${BASE_URL}/#founder`,
      // TODO: Replace 'LastDonor Editorial Team' with the actual founder's full name
      // once the public-facing team/about page is live. Required for EEAT.
      name: 'LastDonor Editorial Team',
      jobTitle: 'Editor-in-Chief',
      url: `${BASE_URL}/about`,
      worksFor: { '@id': `${BASE_URL}/#organization` },
      sameAs: [
        'https://www.linkedin.com/company/lastdonor',
        // Add founder's personal LinkedIn / Twitter once confirmed
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      name: 'LastDonor.org',
      url: BASE_URL,
      publisher: { '@id': `${BASE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    // SiteNavigationElement nodes — tells Google's Sitelinks algorithm exactly
    // which pages are the primary navigation destinations for this domain.
    // Each node corresponds to a top-level nav item visible to every visitor.
    {
      '@type': 'SiteNavigationElement',
      '@id': `${BASE_URL}/#nav-campaigns`,
      name: 'Find a Campaign',
      description: 'Browse human-verified crowdfunding campaigns raising money now',
      url: `${BASE_URL}/campaigns`,
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': `${BASE_URL}/#nav-start`,
      name: 'Start a Campaign',
      description: 'Submit your story for editorial review and launch a verified fundraiser',
      url: `${BASE_URL}/share-your-story`,
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': `${BASE_URL}/#nav-how-it-works`,
      name: 'How It Works',
      description: 'Step-by-step guide to how LastDonor.org verifies campaigns and tracks donations',
      url: `${BASE_URL}/how-it-works`,
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': `${BASE_URL}/#nav-about`,
      name: 'About LastDonor.org',
      description: '501(c)(3) nonprofit crowdfunding with 0% platform fees and human-verified campaigns',
      url: `${BASE_URL}/about`,
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': `${BASE_URL}/#nav-transparency`,
      name: 'Transparency',
      description: 'Live platform stats, donation records, and IRS filings',
      url: `${BASE_URL}/transparency`,
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': `${BASE_URL}/#nav-donate`,
      name: 'Donate',
      description: 'Make a one-time or recurring donation to a verified campaign',
      url: `${BASE_URL}/donate`,
    },
  ],
};
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/Providers';
import { SkipToContent } from '@/components/layout/SkipToContent';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const dmMono = DM_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | LastDonor.org',
    default: 'Online Fundraising Platform with 0% Fees | LastDonor.org',
  },
  description:
    'Verified crowdfunding for military families, veterans, first responders, disaster victims, and people in crisis. 0% platform fees. Every campaign is human-verified. Every dollar tracked.',
  metadataBase: new URL('https://lastdonor.org'),
  alternates: {
    canonical: 'https://lastdonor.org',
  },
  openGraph: {
    siteName: 'LastDonor.org',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/api/v1/og/page?title=LastDonor.org&subtitle=Crowdfunding+built+on+trust.+0%25+platform+fees.+Every+campaign+verified.',
        width: 1200,
        height: 630,
        alt: 'LastDonor.org - Online Fundraising Platform with 0% Fees',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@lastdonororg',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        dmSerifDisplay.variable,
        dmSans.variable,
        dmMono.variable,
      )}
    >
      <head>
        {/* Preconnect to critical third-party origins */}
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://ntnrcedafgmeyajmzvga.supabase.co" />
        <link rel="dns-prefetch" href="https://ntnrcedafgmeyajmzvga.supabase.co" />
        <link rel="dns-prefetch" href="https://plausible.io" />
        {/* Tawk.to live chat — preconnect reduces widget load latency */}
        <link rel="preconnect" href="https://embed.tawk.to" />
        <link rel="dns-prefetch" href="https://embed.tawk.to" />
        <link rel="dns-prefetch" href="https://va.tawk.to" />
        {/* Structured data: @graph merges Organization + Person + WebSite into one
            block so JSON-LD @id cross-references resolve within a shared graph context. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchemaGraph) }}
        />
        {/* Prevent dark-mode flash by applying theme before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <script
          defer
          data-domain="lastdonor.org"
          src="https://plausible.io/js/script.js"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background font-body text-foreground antialiased">
        <noscript data-nosnippet aria-hidden="true">
          <div className="bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200">
            JavaScript is required to donate and interact with campaigns. Please enable JavaScript to continue.
          </div>
        </noscript>
        <Providers>
          <SkipToContent />
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}

