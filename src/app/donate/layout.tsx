import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'Support the LastDonor.org general fund. Zero hidden fees, zero tip sliders. Your donation goes directly to keeping verified campaigns running for people who need help.',
  openGraph: {
    title: 'Donate to LastDonor.org',
    description:
      'Zero hidden fees. Your donation keeps verified campaigns running for people who need help.',
    images: [
      {
        url: '/api/v1/og/page?title=Donate&subtitle=Zero+hidden+fees.+Your+entire+donation+goes+to+the+campaign.',
        width: 1200,
        height: 630,
        alt: 'Donate on LastDonor.org',
      },
    ],
  },
};

export default function DonateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
