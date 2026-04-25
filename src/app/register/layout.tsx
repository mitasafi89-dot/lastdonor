import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Account | Last Donor',
  description:
    'Join Last Donor to start a fundraiser or support reviewed campaigns with 0% platform fees and visible campaign updates.',
  robots: { index: false, follow: false },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
