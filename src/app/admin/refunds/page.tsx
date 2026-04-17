import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { RefundBatchDashboard } from '@/components/admin/RefundBatchDashboard';

export const metadata: Metadata = {
  title: 'Refund Batches - Admin - LastDonor.org',
  robots: { index: false },
};

export default async function AdminRefundsPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/admin');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Refund Batches</h1>
        <p className="text-sm text-muted-foreground">
          Track and manage campaign refund processing
        </p>
      </div>
      <RefundBatchDashboard />
    </>
  );
}
