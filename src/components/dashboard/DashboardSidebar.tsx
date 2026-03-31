'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  MegaphoneIcon,
  PlusCircleIcon,
  HeartIcon,
  HandThumbUpIcon,
  BanknotesIcon,
  CreditCardIcon,
  BellIcon,
  NewspaperIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  external?: boolean;
};

type NavGroup = {
  label: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  requiresCampaigns?: boolean;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
    ],
  },
  {
    label: 'My Campaigns',
    collapsible: true,
    items: [
      { href: '/dashboard/campaigns', label: 'All Campaigns', icon: MegaphoneIcon },
      { href: '/share-your-story', label: 'Create Campaign', icon: PlusCircleIcon },
    ],
  },
  {
    label: 'My Donations',
    collapsible: true,
    items: [
      { href: '/dashboard/donations', label: 'Donation History', icon: HeartIcon },
      { href: '/dashboard/supported', label: 'Supported Campaigns', icon: HandThumbUpIcon },
    ],
  },
  {
    label: 'Finance',
    collapsible: true,
    requiresCampaigns: true,
    items: [
      { href: '/dashboard/withdrawals', label: 'Finances', icon: BanknotesIcon },
      { href: '/dashboard/payout-settings', label: 'Payout Account', icon: CreditCardIcon },
    ],
  },
  {
    label: 'Activity',
    collapsible: true,
    items: [
      { href: '/dashboard/notifications', label: 'Notifications', icon: BellIcon },
      { href: '/dashboard/updates', label: 'Campaign Updates', icon: NewspaperIcon },
    ],
  },
  {
    label: 'Account',
    collapsible: true,
    items: [
      { href: '/dashboard/profile', label: 'Profile', icon: UserCircleIcon },
      { href: '/dashboard/settings', label: 'Settings', icon: Cog6ToothIcon },
    ],
  },
];

export function DashboardSidebar({ hasCampaigns }: { hasCampaigns: boolean }) {
  const pathname = usePathname();

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      if (group.collapsible) {
        // Auto-expand the group containing the current active link
        const hasActiveItem = group.items.some((item) => {
          if (item.href === '/dashboard') return pathname === '/dashboard';
          return pathname.startsWith(item.href);
        });
        initial[group.label] = hasActiveItem;
      }
    }
    return initial;
  });

  const toggleGroup = (label: string) => {
    setExpanded((prev) => {
      const isOpening = !prev[label];
      if (!isOpening) return { ...prev, [label]: false };
      // Accordion: close all others, open this one
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) next[key] = false;
      next[label] = true;
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col justify-between" aria-label="Dashboard navigation">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4">
        {NAV_GROUPS.map((group, groupIdx) => {
          if (group.requiresCampaigns && !hasCampaigns) return null;

          const isCollapsible = group.collapsible;
          const isOpen = isCollapsible ? expanded[group.label] : true;

          return (
            <div key={group.label}>
              {groupIdx > 0 && (
                <div className="my-2 border-t border-border" />
              )}

              {isCollapsible ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                  aria-expanded={isOpen}
                >
                  {group.label}
                  <ChevronDownIcon
                    className={cn(
                      'h-3 w-3 transition-transform duration-150',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
              ) : (
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}

              <div
                className={cn(
                  'overflow-hidden transition-all duration-150',
                  isCollapsible && !isOpen && 'max-h-0 opacity-0',
                  isCollapsible && isOpen && 'max-h-[28rem] opacity-100',
                  !isCollapsible && 'max-h-[28rem]',
                )}
              >
                <div className="mt-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex h-8 items-center gap-3 px-4 text-sm transition-colors duration-100',
                          active
                            ? 'bg-primary/8 font-medium text-foreground before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground/50')} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
