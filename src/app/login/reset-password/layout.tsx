import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | Last Donor',
  description:
    'Create a new password for your Last Donor account. Choose something strong and get back to supporting the causes you care about.',
  openGraph: {
    title: 'Reset Password | Last Donor',
    description:
      'Create a new password for your Last Donor account. Choose something strong and get back to supporting the causes you care about.',
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
