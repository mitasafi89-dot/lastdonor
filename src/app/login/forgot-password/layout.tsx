import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password | Last Donor',
  description:
    'Reset your Last Donor password. Enter your email and we will send you a link to get back into your account.',
  openGraph: {
    title: 'Forgot Password | Last Donor',
    description:
      'Reset your Last Donor password. Enter your email and we will send you a link to get back into your account.',
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
