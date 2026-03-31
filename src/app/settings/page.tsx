import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import SettingsPageClient from '@/components/user/SettingsPageClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings — LastDonor.org',
  robots: { index: false },
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/settings');

  return <SettingsPageClient />;
}
