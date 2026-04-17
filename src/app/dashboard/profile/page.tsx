import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account - Dashboard - LastDonor.org',
  robots: { index: false },
};

export default function DashboardProfilePage() {
  redirect('/dashboard/settings');
}
