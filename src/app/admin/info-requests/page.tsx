import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { InfoRequestsDashboard } from '@/components/admin/InfoRequestsDashboard';

export const metadata: Metadata = {
  title: 'Info Requests - Admin - LastDonor.org',
  robots: { index: false },
};

export default async function AdminInfoRequestsPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/admin');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Info Requests</h1>
        <p className="text-sm text-muted-foreground">
          Verification information requests from campaigns
        </p>
      </div>
      <InfoRequestsDashboard />
    </>
  );
}
