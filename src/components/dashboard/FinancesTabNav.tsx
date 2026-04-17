'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/dashboard/finances', label: 'Donation History' },
  { href: '/dashboard/finances/payouts', label: 'Payouts' },
] as const;

export function FinancesTabNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-5 flex gap-1 border-b border-[#E5E7EB] dark:border-white/10" aria-label="Finances tabs">
      {TABS.map((tab) => {
        const isActive =
          tab.href === '/dashboard/finances'
            ? pathname === '/dashboard/finances'
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative px-4 pb-3 pt-1 text-[14px] font-medium transition-colors duration-150',
              isActive
                ? 'text-[#0F766E] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#0F766E]'
                : 'text-[#6B7280] hover:text-[#111827] dark:hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
