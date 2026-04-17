'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardMobileNav } from './DashboardMobileNav';

const STORAGE_KEY = 'sidebar-collapsed';

export function DashboardShell({
  hasCampaigns,
  children,
}: {
  hasCampaigns: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') setCollapsed(true);
    } catch {
      // localStorage unavailable (SSR, incognito, etc.)
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 overflow-hidden border-r border-[#E5E7EB] bg-[#F9FAFB] transition-[width] duration-200 ease-in-out lg:block',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <DashboardSidebar
          hasCampaigns={hasCampaigns}
          collapsed={collapsed}
          onToggle={toggle}
        />
      </aside>

      {/* Main content area */}
      <main className="min-w-0 flex-1 bg-[#F9FAFB]">
        {/* Mobile nav trigger */}
        <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 lg:hidden">
          <DashboardMobileNav hasCampaigns={hasCampaigns} />
        </div>

        {/* Page content */}
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
