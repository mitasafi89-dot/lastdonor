'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BellIcon } from '@heroicons/react/24/outline';
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  TrashIcon,
  DocumentPlusIcon,
} from '@heroicons/react/24/outline';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { playNotificationSound } from '@/lib/notification-sound';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

// ─── Type → Icon mapping ────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  donation_refunded:        ArrowPathIcon,
  donation_refund_reversed: ArrowUturnLeftIcon,
  campaign_completed:       CheckCircleIcon,
  campaign_archived:        ArchiveBoxIcon,
  campaign_status_changed:  ExclamationCircleIcon,
  role_changed:             ShieldCheckIcon,
  account_deleted:          TrashIcon,
  campaign_submitted:       DocumentPlusIcon,
};

const TYPE_COLOR: Record<string, string> = {
  donation_refunded:        'text-amber-500',
  donation_refund_reversed: 'text-emerald-500',
  campaign_completed:       'text-emerald-500',
  campaign_archived:        'text-muted-foreground',
  campaign_status_changed:  'text-amber-500',
  role_changed:             'text-blue-500',
  account_deleted:          'text-destructive',
  campaign_submitted:       'text-blue-500',
};

// ─── Timestamp ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const prevUnreadRef = useRef(-1); // -1 sentinel: don't chime on first load

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications?limit=30');
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        setNotifications(json.data.notifications);
        const newCount = json.data.unreadCount as number;

        // Play sound when new notifications arrive (not on first load)
        if (newCount > prevUnreadRef.current && prevUnreadRef.current !== -1) {
          playNotificationSound();
        }
        prevUnreadRef.current = newCount;
        setUnreadCount(newCount);
      }
    } catch {
      // Silently fail — non-critical UI
    }
  }, []);

  // Poll every 30s
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [status, fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => {
      const next = Math.max(0, c - 1);
      prevUnreadRef.current = next;
      return next;
    });
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    prevUnreadRef.current = 0;
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => {});
  };

  const clearAll = async () => {
    setNotifications([]);
    setUnreadCount(0);
    prevUnreadRef.current = 0;
    await fetch('/api/v1/notifications', {
      method: 'DELETE',
    }).catch(() => {});
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  if (status !== 'authenticated') return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-96 p-0 shadow-lg">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">Notifications</h3>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                Mark all as read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Notification list ──────────────────────────────────── */}
        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BellIcon className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs">We&apos;ll let you know when something happens</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? InformationCircleIcon;
              const iconColor = TYPE_COLOR[n.type] ?? 'text-muted-foreground';

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/50 last:border-b-0',
                    !n.read && 'bg-primary/[0.03]',
                  )}
                >
                  {/* Icon */}
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted', iconColor)}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'text-sm leading-snug',
                      !n.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                    )}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                      {n.message}
                    </p>
                    <span className="mt-1 block text-[11px] text-muted-foreground/60">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
