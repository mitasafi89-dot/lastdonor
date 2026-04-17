import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account - LastDonor.org',
  robots: { index: false },
};

export default function ProfilePage() {
  redirect('/dashboard/settings');
}
