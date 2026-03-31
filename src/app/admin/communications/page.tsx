import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BulkEmailDashboard } from '@/components/admin/BulkEmailDashboard';

export const metadata: Metadata = {
  title: 'Communications — Admin — LastDonor.org',
  robots: { index: false },
};

export default async function AdminCommunicationsPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/admin');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
        <p className="text-sm text-muted-foreground">
          Manage and send bulk email notifications
        </p>
      </div>
      <BulkEmailDashboard />
    </>
  );
}
