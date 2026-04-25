import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings - LastDonor.org',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  redirect('/dashboard/settings');
}
