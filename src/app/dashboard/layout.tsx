import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard');
  }

  // Check if user has any campaigns (to conditionally show Finance section)
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(eq(campaigns.creatorId, session.user.id));
  const hasCampaigns = (result?.count ?? 0) > 0;

  return (
    <DashboardShell hasCampaigns={hasCampaigns}>
      {children}
    </DashboardShell>
  );
}
