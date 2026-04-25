import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In | Last Donor',
  description:
    'Log in to your Last Donor account to manage donations, track campaigns, and see campaign updates.',
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
