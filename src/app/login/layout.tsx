import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In | Last Donor',
  description:
    'Log in to your Last Donor account to manage donations, track campaigns, and see exactly where your money went.',
  openGraph: {
    title: 'Log In | Last Donor',
    description:
      'Log in to your Last Donor account to manage donations, track campaigns, and see exactly where your money went.',
    images: [
      {
        url: '/api/v1/og/page?title=Log+In&subtitle=Manage+your+donations+and+campaigns.',
        width: 1200,
        height: 630,
        alt: 'Log In to LastDonor.org',
      },
    ],
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
