'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatRelativeTime } from '@/lib/utils/dates';
import { cn } from '@/lib/utils';

export interface MessageItem {
  id: string;
  donorName: string;
  donorLocation: string | null;
  message: string;
  isAnonymous: boolean;
  createdAt: string;
}

interface MessageWallProps {
  campaignSlug: string;
  initialMessages: MessageItem[];
  className?: string;
}

const POLL_INTERVAL_MS = 30_000;
const PAGE_SIZE = 20;
const MESSAGE_TRUNCATE_LENGTH = 200;

export function MessageWall({
  campaignSlug,
  initialMessages,
  className,
}: MessageWallProps) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE);
  const cursorRef = useRef(initialMessages.length);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Expose a method for optimistic message insertion
  const addOptimisticMessage = useCallback((msg: MessageItem) => {
    setMessages((prev) => [msg, ...prev]);
  }, []);

  // Expose via ref on window for MessageForm to call
  useEffect(() => {
    (window as Window & { __addOptimisticMessage?: (msg: MessageItem) => void }).__addOptimisticMessage = addOptimisticMessage;
    return () => {
      delete (window as Window & { __addOptimisticMessage?: (msg: MessageItem) => void }).__addOptimisticMessage;
    };
  }, [addOptimisticMessage]);

  // Poll for new messages
  useEffect(() => {
    const controller = new AbortController();

    async function poll() {
      try {
        const res = await fetch(
          `/api/v1/campaigns/${encodeURIComponent(campaignSlug)}/messages?limit=${PAGE_SIZE}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok && json.data.length > 0) {
          const fresh = json.data as MessageItem[];
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = fresh.filter((m) => !existingIds.has(m.id));
            if (newItems.length === 0) return prev;
            return [...newItems, ...prev];
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

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/campaigns/${encodeURIComponent(campaignSlug)}/messages?cursor=${cursorRef.current}&limit=${PAGE_SIZE}`,
      );
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        const older = json.data as MessageItem[];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const unique = older.filter((m) => !existingIds.has(m.id));
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
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="font-display text-lg font-semibold text-card-foreground">
        Messages of Support
      </h3>

      <div aria-live="polite" aria-atomic="false" className="space-y-3">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No messages yet. Be the first to leave a message of support!
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isLong = msg.message.length > MESSAGE_TRUNCATE_LENGTH;
              const expanded = expandedIds.has(msg.id);
              const displayText = isLong && !expanded
                ? msg.message.slice(0, MESSAGE_TRUNCATE_LENGTH) + '…'
                : msg.message;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {/* Avatar */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {msg.isAnonymous ? '?' : msg.donorName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-card-foreground">
                        {msg.isAnonymous ? 'Anonymous' : msg.donorName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(msg.createdAt)}
                      </span>
                    </div>

                    {!msg.isAnonymous && msg.donorLocation && (
                      <p className="text-xs text-muted-foreground">{msg.donorLocation}</p>
                    )}

                    <p className="mt-1 text-sm text-muted-foreground">
                      {displayText}
                    </p>

                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(msg.id)}
                        className="mt-1 text-xs font-medium text-primary hover:underline"
                      >
                        {expanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more messages'}
        </button>
      )}
    </div>
  );
}
