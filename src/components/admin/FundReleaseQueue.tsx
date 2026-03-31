'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { centsToDollars } from '@/lib/utils/currency';
import { formatDate, formatRelativeTime } from '@/lib/utils/dates';
import { toast } from 'sonner';
import {
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  DocumentIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

/* ─── Types ─── */

interface FundReleaseItem {
  milestoneId: string;
  phase: number;
  title: string;
  description: string;
  evidenceType: string;
  fundPercentage: number;
  fundAmount: number;
  milestoneStatus: string;
  estimatedCompletion: string | null;
  milestoneCreatedAt: string;
  milestoneUpdatedAt: string;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  campaignStatus: string;
  campaignGoalAmount: number;
  campaignRaisedAmount: number;
  campaignTotalReleased: number;
  verificationStatus: string;
  creatorName: string | null;
  creatorEmail: string | null;
  evidenceCount: number;
}

interface FundReleaseQueueProps {
  initialItems: FundReleaseItem[];
  stats: {
    totalEvidenceSubmitted: number;
    totalApproved: number;
    totalRejected: number;
    totalPending: number;
    totalReached: number;
  };
}

interface EvidenceFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  description: string | null;
  status: string;
  reviewerNotes: string | null;
  attemptNumber: number;
  createdAt: string;
}

/* ─── Constants ─── */

const PAGE_SIZE = 25;
type SortField = 'campaignTitle' | 'fundAmount' | 'evidenceCount' | 'milestoneUpdatedAt';
type SortDir = 'asc' | 'desc';
type MilestoneAction = 'approve' | 'reject';

const STAT_KEYS = ['awaiting', 'approved', 'rejected', 'reached', 'pending'] as const;
type StatusFilter = typeof STAT_KEYS[number] | 'all';

const STATUS_FILTER_MAP: Record<StatusFilter, string | null> = {
  all: null,
  awaiting: 'evidence_submitted',
  approved: 'approved',
  rejected: 'rejected',
  reached: 'reached',
  pending: 'pending',
};

/* ─── Component ─── */

export function FundReleaseQueue({ initialItems, stats }: FundReleaseQueueProps) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('awaiting');
  const [sortField, setSortField] = useState<SortField>('milestoneUpdatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  /* Review dialog */
  const [reviewTarget, setReviewTarget] = useState<FundReleaseItem | null>(null);
  const [reviewAction, setReviewAction] = useState<MilestoneAction | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  /* Evidence viewer dialog */
  const [evidenceTarget, setEvidenceTarget] = useState<FundReleaseItem | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let result = items;
    const filterStatus = STATUS_FILTER_MAP[statusFilter];
    if (filterStatus) {
      result = result.filter((item) => item.milestoneStatus === filterStatus);
    }
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter(
      (item) =>
        item.campaignTitle.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.creatorName?.toLowerCase().includes(q) ||
        item.creatorEmail?.toLowerCase().includes(q),
    );
  }, [items, search, statusFilter]);

  /* ── Sorting ── */
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'campaignTitle': cmp = a.campaignTitle.localeCompare(b.campaignTitle); break;
        case 'fundAmount': cmp = (a.fundAmount ?? 0) - (b.fundAmount ?? 0); break;
        case 'evidenceCount': cmp = a.evidenceCount - b.evidenceCount; break;
        case 'milestoneUpdatedAt': cmp = a.milestoneUpdatedAt.localeCompare(b.milestoneUpdatedAt); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDir]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updateFilter<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  /* ── Sort toggle ── */
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'fundAmount' || field === 'evidenceCount' ? 'desc' : 'asc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUpIcon className="ml-1 inline h-3 w-3" />
      : <ChevronDownIcon className="ml-1 inline h-3 w-3" />;
  }

  /* ── Review actions ── */
  const openReview = useCallback((item: FundReleaseItem, action: MilestoneAction) => {
    setReviewTarget(item);
    setReviewAction(action);
    setReviewNotes('');
  }, []);

  const closeReview = useCallback(() => {
    setReviewTarget(null);
    setReviewAction(null);
    setReviewNotes('');
  }, []);

  const openEvidence = useCallback(async (item: FundReleaseItem) => {
    setEvidenceTarget(item);
    setEvidenceFiles(null);
    setLoadingEvidence(true);
    try {
      const res = await fetch(`/api/v1/admin/campaigns/${item.campaignId}/milestones/${item.phase}`);
      const data = await res.json();
      setEvidenceFiles(res.ok ? data.data.evidence : []);
    } catch {
      setEvidenceFiles([]);
    } finally {
      setLoadingEvidence(false);
    }
  }, []);

  const closeEvidence = useCallback(() => {
    setEvidenceTarget(null);
    setEvidenceFiles(null);
  }, []);

  const handleReview = useCallback(async () => {
    if (!reviewTarget || !reviewAction) return;
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/v1/admin/campaigns/${reviewTarget.campaignId}/milestones/${reviewTarget.phase}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: reviewAction,
            notes: reviewNotes.trim() || undefined,
          }),
        },
      );

      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.milestoneId !== reviewTarget.milestoneId));
        toast.success(
          `Phase ${reviewTarget.phase} "${reviewTarget.title}" — ${reviewAction === 'approve' ? 'Approved' : 'Rejected'}`,
        );
      } else {
        const data = await res.json();
        toast.error(data.error?.message || 'Review action failed');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
      closeReview();
    }
  }, [reviewTarget, reviewAction, reviewNotes, closeReview]);

  const hasActiveFilters = search !== '' || statusFilter !== 'awaiting';

  return (
    <div className="space-y-4">

      {/* ── Status tiles ── */}
      <div className="flex flex-wrap gap-2">
        {STAT_KEYS.map((key) => {
          const value = key === 'awaiting' ? stats.totalEvidenceSubmitted
            : key === 'approved' ? stats.totalApproved
              : key === 'rejected' ? stats.totalRejected
                : key === 'reached' ? stats.totalReached
                  : stats.totalPending;
          const label = key === 'awaiting' ? 'Awaiting review'
            : key === 'approved' ? 'Approved'
              : key === 'rejected' ? 'Rejected'
                : key === 'reached' ? 'Reached (needs evidence)'
                  : 'Pending (unfunded)';
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setStatusFilter(isActive ? 'all' : key); setPage(1); }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-background hover:bg-muted/50'
              }`}
            >
              <span className="block text-lg font-semibold tabular-nums leading-none">{value}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search campaign, milestone, creator…"
            value={search}
            onChange={(e) => updateFilter(setSearch)(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search fund release queue"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(''); setStatusFilter('awaiting'); setPage(1); }}>
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Data table ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <ShieldCheckIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No milestones awaiting review</p>
          {hasActiveFilters && (
            <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => { setSearch(''); setStatusFilter('awaiting'); setPage(1); }}>
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => toggleSort('campaignTitle')} className="font-semibold text-muted-foreground hover:text-foreground">
                    Campaign<SortIcon field="campaignTitle" />
                  </button>
                </th>
                <th className="hidden px-3 py-2 text-left sm:table-cell">
                  <span className="font-semibold text-muted-foreground">Milestone</span>
                </th>
                <th className="px-3 py-2 text-right">
                  <button type="button" onClick={() => toggleSort('fundAmount')} className="font-semibold text-muted-foreground hover:text-foreground">
                    Release<SortIcon field="fundAmount" />
                  </button>
                </th>
                <th className="hidden px-3 py-2 text-right md:table-cell">
                  <button type="button" onClick={() => toggleSort('evidenceCount')} className="font-semibold text-muted-foreground hover:text-foreground">
                    Evidence<SortIcon field="evidenceCount" />
                  </button>
                </th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">
                  <span className="font-semibold text-muted-foreground">Creator</span>
                </th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">
                  <button type="button" onClick={() => toggleSort('milestoneUpdatedAt')} className="font-semibold text-muted-foreground hover:text-foreground">
                    Updated<SortIcon field="milestoneUpdatedAt" />
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((item) => (
                <tr key={item.milestoneId} className="transition-colors duration-100 hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <Link
                      href={`/campaigns/${item.campaignSlug}`}
                      className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      target="_blank"
                    >
                      {item.campaignTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {centsToDollars(item.campaignRaisedAmount)} / {centsToDollars(item.campaignGoalAmount)}
                    </p>
                    {item.verificationStatus !== 'fully_verified' && (
                      <Badge variant="destructive" className="mt-1 text-[10px]">
                        Not fully verified
                      </Badge>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <p className="text-sm font-medium">Phase {item.phase}: {item.title}</p>
                    <p className="max-w-[200px] truncate text-xs text-muted-foreground">{item.description}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p className="font-mono text-sm tabular-nums">{centsToDollars(item.fundAmount)}</p>
                    <p className="text-xs text-muted-foreground">{item.fundPercentage}%</p>
                  </td>
                  <td className="hidden px-3 py-3 text-right md:table-cell">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">{item.evidenceCount}</span>
                  </td>
                  <td className="hidden px-3 py-3 lg:table-cell">
                    <p className="truncate text-sm">{item.creatorName ?? 'Unknown'}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.creatorEmail}</p>
                  </td>
                  <td className="hidden px-3 py-3 lg:table-cell">
                    <span className="text-xs text-muted-foreground" title={formatDate(item.milestoneUpdatedAt)}>
                      {formatRelativeTime(item.milestoneUpdatedAt)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openEvidence(item)}
                      >
                        <DocumentIcon className="mr-1 h-3.5 w-3.5" />
                        Evidence ({item.evidenceCount})
                      </Button>
                      {item.milestoneStatus === 'evidence_submitted' && (
                        <>
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => openReview(item, 'approve')}>
                            Approve
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => openReview(item, 'reject')}>
                            Reject
                          </Button>
                        </>
                      )}
                      {item.milestoneStatus !== 'evidence_submitted' && (
                        <Badge variant={item.milestoneStatus === 'approved' ? 'default' : item.milestoneStatus === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                          {item.milestoneStatus === 'evidence_submitted' ? 'Awaiting' : item.milestoneStatus}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs tabular-nums text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Review confirmation dialog ── */}
      <Dialog open={!!reviewTarget && !!reviewAction} onOpenChange={() => closeReview()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Milestone & Release Funds' : 'Reject Milestone Evidence'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? `This will approve Phase ${reviewTarget?.phase} "${reviewTarget?.title}" and release ${centsToDollars(reviewTarget?.fundAmount ?? 0)} (${reviewTarget?.fundPercentage}% of goal) to the campaigner.`
                : `This will reject the evidence for Phase ${reviewTarget?.phase} "${reviewTarget?.title}". The campaigner will need to submit new evidence.`
              }
            </DialogDescription>
          </DialogHeader>

          {reviewAction === 'approve' && reviewTarget && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Fund Release Summary:</strong> {centsToDollars(reviewTarget.fundAmount)} will be queued for transfer.
                Campaign has already released {centsToDollars(reviewTarget.campaignTotalReleased)} of {centsToDollars(reviewTarget.campaignRaisedAmount)} raised.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="milestoneNotes">
              Notes {reviewAction === 'reject' ? '(required)' : '(optional)'}
            </Label>
            <Textarea
              id="milestoneNotes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={
                reviewAction === 'reject'
                  ? 'Explain why the evidence was insufficient…'
                  : 'Optional notes about this milestone approval…'
              }
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeReview} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleReview}
              disabled={processing || (reviewAction === 'reject' && !reviewNotes.trim())}
            >
              {processing
                ? 'Processing…'
                : reviewAction === 'approve'
                  ? 'Approve & Release Funds'
                  : 'Reject Evidence'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Evidence viewer dialog ── */}
      <Dialog open={!!evidenceTarget} onOpenChange={closeEvidence}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DocumentIcon className="h-5 w-5 shrink-0" />
              Evidence: Phase {evidenceTarget?.phase} - {evidenceTarget?.title}
            </DialogTitle>
            <DialogDescription>
              {evidenceTarget?.campaignTitle} &bull; Expected: {evidenceTarget?.evidenceType.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          {loadingEvidence ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading evidence files&hellip;</p>
          ) : !evidenceFiles || evidenceFiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No evidence files have been submitted for this milestone.</p>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {evidenceFiles.map((file) => (
                <div key={file.id} className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.fileName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(file.fileSize / 1024).toFixed(0)} KB &bull; Attempt #{file.attemptNumber} &bull; {formatRelativeTime(file.createdAt)}
                    </p>
                    {file.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{file.description}</p>
                    )}
                    {file.reviewerNotes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">Reviewer: {file.reviewerNotes}</p>
                    )}
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      file.status === 'approved'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : file.status === 'rejected'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {file.status}
                    </span>
                  </div>
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-sm text-brand-teal underline underline-offset-2 hover:text-brand-teal/80"
                  >
                    View
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEvidence}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


