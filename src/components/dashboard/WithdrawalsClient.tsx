'use client';

import { useState } from 'react';
import Link from 'next/link';

type Withdrawal = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  amount: number;
  status: string;
  notes: string | null;
  failureReason: string | null;
  requestedAt: string;
  processedAt: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  requested: { label: 'Requested', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  processing: { label: 'Processing', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const FILTER_OPTIONS = ['all', 'requested', 'approved', 'processing', 'completed', 'rejected', 'failed'] as const;

export default function WithdrawalsClient({ withdrawals }: { withdrawals: Withdrawal[] }) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? withdrawals : withdrawals.filter((w) => w.status === filter);

  const totalCompleted = withdrawals
    .filter((w) => w.status === 'completed')
    .reduce((sum, w) => sum + w.amount, 0);

  const totalPending = withdrawals
    .filter((w) => ['requested', 'approved', 'processing'].includes(w.status))
    .reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Withdrawn</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            ${(totalCompleted / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            ${(totalPending / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Requests</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{withdrawals.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt === 'all' ? withdrawals.length : withdrawals.filter((w) => w.status === opt).length;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setFilter(opt)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === opt
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Withdrawals list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {withdrawals.length === 0 ? 'No withdrawal requests yet' : 'No withdrawals match the selected filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => {
            const cfg = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.requested;
            return (
              <div
                key={w.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/campaigns/${w.campaignSlug}`}
                    className="text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {w.campaignTitle}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(w.requestedAt).toLocaleDateString()}
                    {w.processedAt && ` · Processed ${new Date(w.processedAt).toLocaleDateString()}`}
                  </p>
                  {w.failureReason && (
                    <p className="text-xs text-destructive">{w.failureReason}</p>
                  )}
                  {w.notes && (
                    <p className="text-xs text-muted-foreground italic">{w.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-foreground">
                    ${(w.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
