import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user || (role !== 'editor' && role !== 'admin')) {
    redirect('/login?callbackUrl=/admin');
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* CDS Left Panel - fixed-width side navigation */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:block">
        <AdminSidebar role={role ?? ''} />
      </aside>

      {/* CDS Content Area - fluid main region */}
      <main className="min-w-0 flex-1">
        {/* Breadcrumb bar - persistent top context strip */}
        <div className="border-b border-border bg-background px-6 py-3">
          <Breadcrumbs />
        </div>

        {/* Page content - CDS spacing: 32px padding (spacing-07) */}
        <div className="px-6 py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
