'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Evidence {
  id: string;
  milestoneId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description: string | null;
  status: string;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  attemptNumber: number;
  createdAt: string;
}

interface FundRelease {
  id: string;
  milestoneId: string;
  amount: number;
  status: string;
  approvedAt: string | null;
  releasedAt: string | null;
  notes: string | null;
}

interface Milestone {
  id: string;
  campaignId: string;
  phase: number;
  title: string;
  description: string;
  evidenceType: string;
  fundPercentage: number;
  status: string;
  fundAmount: number | null;
  releasedAmount: number;
  releasedAt: string | null;
  estimatedCompletion: string | null;
  evidence: Evidence[];
  fundRelease: FundRelease | null;
}

interface MilestoneEvidenceProps {
  campaignId: string;
  campaignTitle: string;
  milestones: Milestone[];
  goalAmount: number;
  raisedAmount: number;
  totalReleasedAmount: number | null;
  totalWithdrawnAmount?: number | null;
  stripeConnectStatus?: string;
  milestoneFundRelease: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function centsToDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  pending:             { label: 'Pending',            variant: 'secondary',    icon: ClockIcon },
  reached:             { label: 'Reached',            variant: 'default',      icon: CheckCircleIcon },
  evidence_submitted:  { label: 'Evidence Submitted', variant: 'default',      icon: DocumentTextIcon },
  approved:            { label: 'Approved',           variant: 'default',      icon: CheckCircleIcon },
  rejected:            { label: 'Rejected',           variant: 'destructive',  icon: XCircleIcon },
  overdue:             { label: 'Overdue',            variant: 'destructive',  icon: ExclamationTriangleIcon },
};

const EVIDENCE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Under Review', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Approved',     className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejected',     className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

const FUND_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  held:       { label: 'Held',       className: 'text-muted-foreground' },
  approved:   { label: 'Approved',   className: 'text-emerald-600 dark:text-emerald-400' },
  processing: { label: 'Processing', className: 'text-amber-600 dark:text-amber-400' },
  released:   { label: 'Released',   className: 'text-emerald-600 dark:text-emerald-400 font-semibold' },
  refunded:   { label: 'Refunded',   className: 'text-red-600 dark:text-red-400' },
};

// ─── Main Component ────────────────────────────────────────────────────────

export function MilestoneEvidenceDashboard({
  campaignId,
  campaignTitle,
  milestones,
  goalAmount,
  raisedAmount,
  totalReleasedAmount,
  totalWithdrawnAmount,
  stripeConnectStatus,
  milestoneFundRelease,
}: MilestoneEvidenceProps) {
  const router = useRouter();
  const [uploadingPhase, setUploadingPhase] = useState<number | null>(null);
  const [description, setDescription] = useState('');

  const handleUploadEvidence = useCallback(
    async (phase: number, files: FileList) => {
      setUploadingPhase(phase);
      try {
        const formData = new FormData();
        for (const file of Array.from(files)) {
          formData.append('file', file);
        }
        if (description.trim()) formData.append('description', description.trim());

        const res = await fetch(
          `/api/v1/user-campaigns/${campaignId}/milestones/${phase}/evidence`,
          { method: 'POST', body: formData },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error?.message || 'Upload failed');
        }

        const result = await res.json();
        const count = result.data?.fileCount ?? files.length;
        toast.success(`${count} file${count !== 1 ? 's' : ''} uploaded successfully`);
        setDescription('');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploadingPhase(null);
      }
    },
    [campaignId, description, router],
  );

  if (!milestoneFundRelease || milestones.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{campaignTitle}</h1>
        <div className="mt-6 rounded-lg border border-border bg-muted/50 p-8 text-center">
          <p className="text-muted-foreground">
            Milestone-based fund release is not enabled for this campaign, or no milestones have been defined yet.
          </p>
        </div>
      </div>
    );
  }

  const approved = milestones.filter((m) => m.status === 'approved').length;
  const total = milestones.length;
  const released = totalReleasedAmount ?? 0;
  const withdrawn = totalWithdrawnAmount ?? 0;
  const availableForWithdrawal = released - withdrawn;
  const needsPayoutSetup = stripeConnectStatus !== 'verified' && released > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Milestone Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">{campaignTitle}</p>
      </div>

      {/* Payout Setup Banner */}
      {needsPayoutSetup && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <BanknotesIcon className="h-5 w-5 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                You have funds available for withdrawal
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                Set up your payout account to withdraw {centsToDollars(availableForWithdrawal)} in released funds.
              </p>
              <a
                href="/dashboard/payout-settings"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-800 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
              >
                Set up payouts
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Funds Available Indicator */}
      {stripeConnectStatus === 'verified' && availableForWithdrawal > 0 && (
        <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BanknotesIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                  <span className="font-mono">{centsToDollars(availableForWithdrawal)}</span> available for withdrawal
                </p>
              </div>
            </div>
            <a
              href="/dashboard/payout-settings"
              className="text-sm font-medium text-teal-700 underline hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
            >
              Withdraw
            </a>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Milestones</p>
          <p className="mt-1 text-2xl font-bold">{approved}/{total}</p>
          <p className="text-xs text-muted-foreground">approved</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Released</p>
          <p className="mt-1 text-2xl font-bold">{centsToDollars(released)}</p>
          <p className="text-xs text-muted-foreground">of {centsToDollars(goalAmount)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Raised</p>
          <p className="mt-1 text-2xl font-bold">{centsToDollars(raisedAmount)}</p>
          <p className="text-xs text-muted-foreground">total donations</p>
        </div>
      </div>

      {/* Milestone Cards */}
      <div className="space-y-6">
        {milestones.map((milestone) => {
          const statusCfg = STATUS_CONFIG[milestone.status] ?? STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const canSubmit = ['reached', 'rejected'].includes(milestone.status);
          const prevApproved =
            milestone.phase === 1 ||
            milestones.find((m) => m.phase === milestone.phase - 1)?.status === 'approved';
          const isSubmittable = canSubmit && prevApproved;
          const isUploading = uploadingPhase === milestone.phase;

          // Group evidence by attempt number
          const latestAttemptNumber = milestone.evidence.length > 0
            ? Math.max(...milestone.evidence.map((e) => e.attemptNumber))
            : 0;
          const latestEvidence = milestone.evidence.filter((e) => e.attemptNumber === latestAttemptNumber);
          const previousEvidence = milestone.evidence.filter((e) => e.attemptNumber < latestAttemptNumber);
          const previousAttempts = [...new Set(previousEvidence.map((e) => e.attemptNumber))].sort((a, b) => b - a);

          return (
            <div
              key={milestone.id}
              className="rounded-lg border border-border bg-background shadow-sm"
            >
              {/* Milestone Header */}
              <div className="flex items-start justify-between border-b border-border px-5 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                      milestone.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : milestone.status === 'rejected'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {milestone.phase}
                  </div>
                  <div>
                    <h3 className="font-semibold">{milestone.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{milestone.description}</p>
                  </div>
                </div>
                <Badge variant={statusCfg.variant} className="flex items-center gap-1 whitespace-nowrap">
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusCfg.label}
                </Badge>
              </div>

              {/* Milestone Details */}
              <div className="space-y-4 px-5 py-4">
                {/* Fund info */}
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fund allocation:</span>{' '}
                    <span className="font-medium">{milestone.fundPercentage}%</span>
                    {milestone.fundAmount != null && (
                      <span className="text-muted-foreground"> ({centsToDollars(milestone.fundAmount)})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Evidence type:</span>{' '}
                    <span className="font-medium capitalize">{milestone.evidenceType.replace(/_/g, ' ')}</span>
                  </div>
                  {milestone.estimatedCompletion && (
                    <div>
                      <span className="text-muted-foreground">Est. completion:</span>{' '}
                      <span className="font-medium">{formatDate(milestone.estimatedCompletion)}</span>
                    </div>
                  )}
                </div>

                {/* Fund Release Status */}
                {milestone.fundRelease && (
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <CurrencyDollarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Fund release:</span>
                    <span className={FUND_STATUS_CONFIG[milestone.fundRelease.status]?.className ?? 'text-muted-foreground'}>
                      {FUND_STATUS_CONFIG[milestone.fundRelease.status]?.label ?? milestone.fundRelease.status}{' '}
                      {centsToDollars(milestone.fundRelease.amount)}
                    </span>
                    {milestone.fundRelease.releasedAt && (
                      <span className="text-xs text-muted-foreground">
                        on {formatDate(milestone.fundRelease.releasedAt)}
                      </span>
                    )}
                  </div>
                )}

                {/* Latest Evidence */}
                {latestEvidence.length > 0 && (
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        Attempt #{latestAttemptNumber} &middot; {latestEvidence.length} file{latestEvidence.length !== 1 ? 's' : ''}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          EVIDENCE_STATUS_CONFIG[latestEvidence[0].status]?.className ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {EVIDENCE_STATUS_CONFIG[latestEvidence[0].status]?.label ?? latestEvidence[0].status}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {latestEvidence.map((ev) => (
                        <div key={ev.id} className="flex items-center gap-2 text-sm">
                          <DocumentTextIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <a
                            href={ev.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline truncate"
                          >
                            {ev.fileName}
                          </a>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({formatFileSize(ev.fileSize)})
                          </span>
                        </div>
                      ))}
                    </div>
                    {latestEvidence[0].description && (
                      <p className="mt-2 text-sm text-muted-foreground">{latestEvidence[0].description}</p>
                    )}
                    {latestEvidence[0].reviewerNotes && (
                      <div className="mt-2 rounded-md bg-amber-50 p-2 dark:bg-amber-950/30">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Reviewer feedback:</p>
                        <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">{latestEvidence[0].reviewerNotes}</p>
                      </div>
                    )}
                    {latestEvidence[0].reviewedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Reviewed on {formatDate(latestEvidence[0].reviewedAt)}
                      </p>
                    )}
                  </div>
                )}

                {/* Previous Attempts (if more than 1 attempt) */}
                {previousAttempts.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {previousAttempts.length} previous attempt{previousAttempts.length > 1 ? 's' : ''}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {previousAttempts.map((attemptNum) => {
                        const attemptFiles = previousEvidence.filter((e) => e.attemptNumber === attemptNum);
                        return (
                          <div key={attemptNum} className="rounded-md border border-border/60 p-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Attempt #{attemptNum} &middot; {attemptFiles.length} file{attemptFiles.length !== 1 ? 's' : ''}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 font-medium',
                                  EVIDENCE_STATUS_CONFIG[attemptFiles[0].status]?.className ?? 'bg-muted text-muted-foreground',
                                )}
                              >
                                {EVIDENCE_STATUS_CONFIG[attemptFiles[0].status]?.label ?? attemptFiles[0].status}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {attemptFiles.map((ev) => (
                                <div key={ev.id} className="flex items-center gap-2 text-xs">
                                  <a
                                    href={ev.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline truncate"
                                  >
                                    {ev.fileName}
                                  </a>
                                </div>
                              ))}
                            </div>
                            {attemptFiles[0].reviewerNotes && (
                              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                Feedback: {attemptFiles[0].reviewerNotes}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* Pending milestone - threshold not yet reached */}
                {milestone.status === 'pending' && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Funding threshold not yet reached for this phase. Evidence submission will be available once this milestone is funded.
                  </div>
                )}

                {/* Upload Form */}
                {isSubmittable && (
                  <div className="rounded-md border border-dashed border-border bg-muted/30 p-4">
                    {milestone.status === 'reached' && (
                      <div className="mb-3 flex items-start gap-2 rounded-md bg-emerald-50 p-2 dark:bg-emerald-950/30">
                        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          This milestone has been funded! Submit evidence of how these funds will be used to unlock your release.
                        </p>
                      </div>
                    )}
                    {milestone.status === 'rejected' && (
                      <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-50 p-2 dark:bg-amber-950/30">
                        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Your previous evidence was rejected. Please review the feedback above and resubmit.
                        </p>
                      </div>
                    )}
                    {!prevApproved && milestone.phase > 1 ? (
                      <p className="text-sm text-muted-foreground">
                        Complete Phase {milestone.phase - 1} before submitting evidence for this milestone.
                      </p>
                    ) : (
                      <>
                        <p className="mb-2 text-sm font-medium">Upload Evidence</p>
                        <p className="mb-3 text-xs text-muted-foreground">
                          Accepted: JPEG, PNG, WebP, PDF. Max 10MB per file. You can select multiple files.
                        </p>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Optional: describe the evidence..."
                          rows={2}
                          className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="file"
                            className="hidden"
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            multiple
                            disabled={isUploading}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) handleUploadEvidence(milestone.phase, files);
                              e.target.value = '';
                            }}
                          />
                          <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                            <ArrowUpTrayIcon className="h-4 w-4" />
                            {isUploading ? 'Uploading...' : 'Choose Files & Upload'}
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
