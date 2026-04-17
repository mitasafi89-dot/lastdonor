'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BellIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';

interface SubscribeButtonProps {
  campaignSlug: string;
  className?: string;
}

export function SubscribeButton({ campaignSlug, className }: SubscribeButtonProps) {
  const { data: session, status } = useSession();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check current subscription status on mount (authed users only)
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch(`/api/v1/campaigns/${campaignSlug}/subscribe`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok) {
          setSubscribed(json.data.subscribed);
          setChecked(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campaignSlug, status]);

  const toggle = useCallback(async () => {
    const email = session?.user?.email;
    if (!email || loading) return;

    setLoading(true);
    const method = subscribed ? 'DELETE' : 'POST';
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignSlug}/subscribe`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.ok) {
        setSubscribed(json.data.subscribed);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [campaignSlug, session?.user?.email, subscribed, loading]);

  // Don't show for unauthenticated users or while session is loading
  if (status !== 'authenticated') return null;

  // Don't flash wrong state while checking
  if (!checked) {
    return (
      <div className={cn('h-9 w-36 animate-pulse rounded-lg bg-muted', className)} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={subscribed}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
        'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        loading && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {subscribed ? (
        <>
          <BellAlertIcon className="h-4 w-4" />
          Subscribed
        </>
      ) : (
        <>
          <BellIcon className="h-4 w-4" />
          Get Updates
        </>
      )}
    </button>
  );
}
