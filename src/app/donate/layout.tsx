import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'Support the LastDonor.org general fund. Donations help cover campaign review, donor support, payment processing, hosting, and impact updates.',
  openGraph: {
    title: 'Donate to LastDonor.org',
    description:
      'General fund donations help keep reviewed campaigns, donor support, and impact updates running.',
    images: [
      {
        url: '/api/v1/og/page?title=Donate&subtitle=Support+reviewed+campaigns%2C+donor+support%2C+and+impact+updates.',
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
