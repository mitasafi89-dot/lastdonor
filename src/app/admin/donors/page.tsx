import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DonorSegmentation } from '@/components/admin/DonorSegmentation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donor CRM — Admin — LastDonor.org',
  robots: { index: false },
};

export default async function AdminDonorsPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    redirect('/admin');
  }

  return <DonorSegmentation />;
}
