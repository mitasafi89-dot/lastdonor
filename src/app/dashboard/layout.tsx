import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardMobileNav } from '@/components/dashboard/DashboardMobileNav';

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
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:block">
        <DashboardSidebar hasCampaigns={hasCampaigns} />
      </aside>

      {/* Main content area */}
      <main className="min-w-0 flex-1">
        {/* Breadcrumb bar with mobile menu trigger */}
        <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
          <DashboardMobileNav hasCampaigns={hasCampaigns} />
          <Breadcrumbs />
        </div>

        {/* Page content */}
        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
