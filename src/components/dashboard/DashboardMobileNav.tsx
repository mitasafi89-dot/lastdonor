'use client';

import { useState } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { DashboardSidebar } from './DashboardSidebar';

export function DashboardMobileNav({ hasCampaigns }: { hasCampaigns: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open navigation menu"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div onClick={() => setOpen(false)}>
            <DashboardSidebar hasCampaigns={hasCampaigns} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
