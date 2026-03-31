import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import SettingsPageClient from '@/components/user/SettingsPageClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings — Dashboard — LastDonor.org',
  robots: { index: false },
};

export default async function DashboardSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard/settings');

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your notification preferences and account settings
      </p>

      <div className="mt-6">
        <SettingsPageClient />
      </div>
    </>
  );
}
