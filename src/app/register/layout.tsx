import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Account | Last Donor',
  description:
    'Join Last Donor to start a fundraiser or support verified campaigns. No platform fees, no hidden tips, and real human support when you need it.',
  openGraph: {
    title: 'Create Your Account | Last Donor',
    description:
      'Join Last Donor to start a fundraiser or support verified campaigns. No platform fees, no hidden tips, and real human support when you need it.',
    images: [
      {
        url: '/api/v1/og/page?title=Create+Your+Account&subtitle=No+platform+fees.+No+hidden+tips.+Real+human+support.',
        width: 1200,
        height: 630,
        alt: 'Create Your Account on LastDonor.org',
      },
    ],
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
