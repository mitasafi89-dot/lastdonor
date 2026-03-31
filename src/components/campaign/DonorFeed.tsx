'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { centsToDollars } from '@/lib/utils/currency';
import { formatRelativeTime } from '@/lib/utils/dates';
import { cn } from '@/lib/utils';

export interface DonorFeedItem {
  id: string;
  donorName: string;
  donorLocation: string | null;
  amount: number;
  message: string | null;
  isAnonymous: boolean;
  createdAt: string;
}

interface DonorFeedProps {
  campaignSlug: string;
  initialDonors: DonorFeedItem[];
  className?: string;
}

const POLL_INTERVAL_MS = 15_000; // 15 seconds

export function DonorFeed({
  campaignSlug,
  initialDonors,
  className,
}: DonorFeedProps) {
  const [donors, setDonors] = useState<DonorFeedItem[]>(initialDonors);
  const latestIdRef = useRef<string | null>(initialDonors[0]?.id ?? null);

  useEffect(() => {
    const controller = new AbortController();

    async function poll() {
      try {
        const params = new URLSearchParams({ limit: '10' });
        if (latestIdRef.current) {
          params.set('after', latestIdRef.current);
        }
        const res = await fetch(
          `/api/v1/campaigns/${campaignSlug}/donors?${params}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok && json.data.length > 0) {
          const newDonors = json.data as DonorFeedItem[];
          latestIdRef.current = newDonors[0].id;
          setDonors((prev) => {
            // Deduplicate by id
            const existingIds = new Set(prev.map((d) => d.id));
            const unique = newDonors.filter((d) => !existingIds.has(d.id));
            return [...unique, ...prev].slice(0, 50);
          });
        }
      } catch {
        // Silently ignore abort & network errors
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [campaignSlug]);

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="font-display text-lg font-semibold text-card-foreground">
        Recent Donors
      </h3>

      <div
        aria-live="polite"
        aria-atomic="false"
        className="space-y-3"
      >
        <AnimatePresence initial={false}>
          {donors.map((donor) => (
            <motion.div
              key={donor.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              {/* Avatar placeholder */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {donor.isAnonymous
                  ? '?'
                  : donor.donorName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-card-foreground">
                    {donor.isAnonymous ? 'Anonymous' : donor.donorName}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold text-primary">
                    {centsToDollars(donor.amount)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {!donor.isAnonymous && donor.donorLocation && (
                    <span>{donor.donorLocation}</span>
                  )}
                  <span>{formatRelativeTime(donor.createdAt)}</span>
                </div>

                {donor.message && (
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    &ldquo;{donor.message}&rdquo;
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {donors.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Be the first to donate!
          </p>
        )}
      </div>
    </div>
  );
}
