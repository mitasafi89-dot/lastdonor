'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePollingListOptions<T> {
  /** URL to fetch new items from. Called with no cursor for polling. */
  buildUrl: (params: { cursor?: number; after?: string }) => string;
  /** Polling interval in ms. */
  pollIntervalMs: number;
  /** Extract unique ID from an item. */
  getId: (item: T) => string;
  /** Max items to keep in the list. */
  maxItems?: number;
}

interface UsePollingListResult<T> {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  addOptimistic: (item: T) => void;
}

/**
 * Hook for a polling live-feed list with deduplication.
 * Extracts the repeated pattern from DonorFeed and MessageWall.
 *
 * - Polls at a given interval for new items (prepended)
 * - Supports load-more (appended)
 * - Deduplicates by ID
 * - Supports optimistic insertions
 */
export function usePollingList<T>(
  initialItems: T[],
  options: UsePollingListOptions<T>,
): UsePollingListResult<T> {
  const { buildUrl, pollIntervalMs, getId, maxItems = 100 } = options;
  const [items, setItems] = useState<T[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length >= 20);
  const cursorRef = useRef(initialItems.length);

  // Deduplicate and merge new items at the front
  const mergeNew = useCallback(
    (fresh: T[]) => {
      setItems((prev) => {
        const existingIds = new Set(prev.map(getId));
        const unique = fresh.filter((item) => !existingIds.has(getId(item)));
        if (unique.length === 0) return prev;
        return [...unique, ...prev].slice(0, maxItems);
      });
    },
    [getId, maxItems],
  );

  // Poll for new items
  useEffect(() => {
    const controller = new AbortController();

    async function poll() {
      try {
        const url = buildUrl({});
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok && json.data?.length > 0) {
          mergeNew(json.data as T[]);
        }
      } catch {
        // Silently ignore abort & network errors during polling
      }
    }

    const interval = setInterval(poll, pollIntervalMs);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [buildUrl, pollIntervalMs, mergeNew]);

  // Load older items
  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const url = buildUrl({ cursor: cursorRef.current });
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        const older = json.data as T[];
        setItems((prev) => {
          const existingIds = new Set(prev.map(getId));
          const unique = older.filter((item) => !existingIds.has(getId(item)));
          return [...prev, ...unique];
        });
        cursorRef.current += older.length;
        setHasMore(json.meta?.hasMore ?? false);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [loading, buildUrl, getId]);

  // Optimistic insert at the front
  const addOptimistic = useCallback(
    (item: T) => {
      setItems((prev) => [item, ...prev]);
    },
    [],
  );

  return { items, loading, hasMore, loadMore, addOptimistic };
}
