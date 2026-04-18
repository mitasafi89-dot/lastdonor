import './globals.css';
import type { Metadata } from 'next';
import { DM_Serif_Display, DM_Sans, DM_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/Providers';
import { SkipToContent } from '@/components/layout/SkipToContent';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Analytics } from '@vercel/analytics/next';

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
    default:
      'LastDonor.org - Donate to Real People in Need | 100% Transparent Charity',
  },
  description:
    'Verified fundraising campaigns for military families, veterans, first responders, disaster victims, and people in crisis. 100% transparent. You\u2019re the reason it\u2019s done.',
  metadataBase: new URL('https://lastdonor.org'),
  openGraph: {
    siteName: 'LastDonor.org',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/api/v1/og/page?title=LastDonor.org&subtitle=Crowdfunding+built+on+trust.+0%25+platform+fees.+Every+campaign+verified.',
        width: 1200,
        height: 630,
        alt: 'LastDonor.org - Donate to Real People in Need',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
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
        <noscript>
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
        <Analytics />
      </body>
    </html>
  );
}
