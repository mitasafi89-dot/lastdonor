'use client';

import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DocumentViewerModal, type ViewerDocument } from '@/components/admin/DocumentViewerModal';
import {
  computeMilestoneDisplayStatus,
  MILESTONE_DISPLAY_LABELS,
  MILESTONE_DISPLAY_COLORS,
  type MilestoneData,
  type FundReleaseData,
  type CampaignVerificationData,
} from '@/lib/milestone-status';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MilestoneItem {
  id: string;
  phase: number;
  title: string;
  status: string;
  fundPercentage: number | null;
  fundAmount: number | null;
  releasedAmount: number | null;
  releasedAt: string | null;
  evidenceCount: number;
  fundRelease: {
    id: string;
    amount: number;
    status: string;
    approvedBy: string | null;
    approvedAt: string | null;
    releasedAt: string | null;
    flaggedForAudit: boolean;
  } | null;
}

interface CampaignItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  verificationStatus: string;
  verificationNotes: string | null;
  verificationReviewedAt: string | null;
  veriffSessionId: string | null;
  goalAmount: number;
  raisedAmount: number;
  totalReleasedAmount: number;
  milestoneFundRelease: boolean;
  creatorId: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
  milestones: MilestoneItem[];
}

interface Stats {
  totalPending: number;
  totalIdentityVerified: number;
  totalFullyVerified: number;
  totalRejected: number;
}

interface VerificationDashboardProps {
  initialCampaigns: CampaignItem[];
  stats: Stats;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const VERIFICATION_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  documents_uploaded: { label: 'Docs Uploaded', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  submitted_for_review: { label: 'Submitted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  identity_verified: { label: 'Identity Verified', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' },
  fully_verified: { label: 'Fully Verified', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  info_requested: { label: 'Info Requested', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

const FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'documents_uploaded', label: 'Docs Uploaded' },
  { value: 'submitted_for_review', label: 'Submitted for Review' },
  { value: 'identity_verified', label: 'Identity Verified' },
  { value: 'fully_verified', label: 'Fully Verified' },
  { value: 'info_requested', label: 'Info Requested' },
  { value: 'rejected', label: 'Rejected' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function VerificationDashboard({ initialCampaigns, stats }: VerificationDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  // Review dialog state
  const [reviewDialog, setReviewDialog] = useState<{
    campaignId: string;
    phase: number;
    action: 'approve' | 'reject' | 'request_info';
    milestoneTitle: string;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Document viewer state
  const [docViewer, setDocViewer] = useState<{
    documents: ViewerDocument[];
    initialIndex: number;
    title: string;
    campaignId: string;
  } | null>(null);

  // ─── Filtering & Pagination ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let items = campaigns;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          c.creatorName?.toLowerCase().includes(q) ||
          c.creatorEmail?.toLowerCase().includes(q),
      );
    }

    if (statusFilter) {
      items = items.filter((c) => c.verificationStatus === statusFilter);
    }

    return items;
  }, [campaigns, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page on filter change
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  // ─── Milestone Display Status Helper ───────────────────────────────────────

  const getMilestoneDisplayStatus = useCallback(
    (milestone: MilestoneItem, campaign: CampaignItem, prevMilestone: MilestoneItem | null) => {
      const campaignVerif: CampaignVerificationData = { verificationStatus: campaign.verificationStatus };
      const milestoneData: MilestoneData = {
        id: milestone.id,
        phase: milestone.phase,
        title: milestone.title,
        status: milestone.status,
        fundPercentage: milestone.fundPercentage,
        fundAmount: milestone.fundAmount,
        releasedAmount: milestone.releasedAmount,
        releasedAt: milestone.releasedAt,
      };
      const releaseData: FundReleaseData | null = milestone.fundRelease
        ? {
            id: milestone.fundRelease.id,
            milestoneId: milestone.id,
            amount: milestone.fundRelease.amount,
            status: milestone.fundRelease.status,
            approvedBy: milestone.fundRelease.approvedBy,
            approvedAt: milestone.fundRelease.approvedAt,
            releasedAt: milestone.fundRelease.releasedAt,
            notes: null,
            flaggedForAudit: milestone.fundRelease.flaggedForAudit,
            flagReason: null,
            pauseReason: null,
          }
        : null;
      const prevData: MilestoneData | null = prevMilestone
        ? {
            id: prevMilestone.id,
            phase: prevMilestone.phase,
            title: prevMilestone.title,
            status: prevMilestone.status,
            fundPercentage: prevMilestone.fundPercentage,
            fundAmount: prevMilestone.fundAmount,
            releasedAmount: prevMilestone.releasedAmount,
            releasedAt: prevMilestone.releasedAt,
          }
        : null;
      return computeMilestoneDisplayStatus(milestoneData, campaignVerif, releaseData, prevData);
    },
    [],
  );

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleReview = useCallback(
    async () => {
      if (!reviewDialog) return;
      const { campaignId, phase, action } = reviewDialog;

      // Map dashboard actions to API actions
      let apiAction: string;
      if (action === 'approve') {
        apiAction = 'approve';
      } else if (action === 'reject') {
        if (!reviewNotes.trim()) {
          toast.error('Notes are required when rejecting');
          return;
        }
        apiAction = 'reject';
      } else {
        apiAction = 'reject'; // request_info handled separately
        return;
      }

      setReviewLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/campaigns/${campaignId}/milestones/${phase}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: apiAction, notes: reviewNotes || undefined }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || 'Failed to process review');
        }

        const data = await res.json();

        // Optimistic update
        setCampaigns((prev) =>
          prev.map((c) => {
            if (c.id !== campaignId) return c;
            return {
              ...c,
              milestones: c.milestones.map((m) => {
                if (m.phase !== phase) return m;
                return {
                  ...m,
                  status: data.data.milestoneStatus,
                  releasedAmount: action === 'approve' ? data.data.releaseAmount ?? m.releasedAmount : m.releasedAmount,
                  releasedAt: action === 'approve' ? new Date().toISOString() : m.releasedAt,
                  fundRelease: action === 'approve'
                    ? {
                        id: 'new',
                        amount: data.data.releaseAmount ?? 0,
                        status: 'approved',
                        approvedBy: null,
                        approvedAt: new Date().toISOString(),
                        releasedAt: null,
                        flaggedForAudit: false,
                      }
                    : m.fundRelease,
                };
              }),
            };
          }),
        );

        toast.success(
          action === 'approve'
            ? `Phase ${phase} approved - $${((data.data.releaseAmount ?? 0) / 100).toLocaleString()} released`
            : `Phase ${phase} rejected`,
        );
        setReviewDialog(null);
        setReviewNotes('');
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setReviewLoading(false);
      }
    },
    [reviewDialog, reviewNotes],
  );

  const fetchDocuments = useCallback(
    async (campaignId: string, phase: number, milestoneTitle: string) => {
      try {
        const res = await fetch(`/api/v1/admin/campaigns/${campaignId}/milestones/${phase}`);
        if (!res.ok) throw new Error('Failed to load documents');
        const data = await res.json();
        const docs: ViewerDocument[] = (data.data.evidence || []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          fileUrl: e.fileUrl as string,
          fileName: e.fileName as string,
          fileSize: e.fileSize as number | null,
          mimeType: e.mimeType as string | null,
          uploadedAt: e.createdAt as string,
          status: e.status as string,
          reviewerNotes: e.reviewerNotes as string | null,
          description: e.description as string | null,
        }));

        if (docs.length === 0) {
          toast.info('No documents uploaded for this milestone');
          return;
        }

        setDocViewer({
          documents: docs,
          initialIndex: 0,
          title: `Phase ${phase}: ${milestoneTitle}`,
          campaignId,
        });
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Pending" value={stats.totalPending} className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" />
        <StatTile label="Identity Verified" value={stats.totalIdentityVerified} className="bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300" />
        <StatTile label="Fully Verified" value={stats.totalFullyVerified} className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" />
        <StatTile label="Rejected" value={stats.totalRejected} className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300" />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns or creators..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => handleFilter(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border rounded-lg bg-background appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left font-medium px-4 py-3 w-8" />
              <th className="text-left font-medium px-4 py-3">Campaign</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Creator</th>
              <th className="text-left font-medium px-4 py-3">Identity</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Milestones</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((campaign) => {
              const isExpanded = expandedId === campaign.id;
              const verifConfig = VERIFICATION_STATUS_CONFIG[campaign.verificationStatus] || {
                label: campaign.verificationStatus,
                className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              };

              // Compute milestone display statuses
              const sortedMilestones = [...campaign.milestones].sort((a, b) => a.phase - b.phase);
              const milestoneStatuses = sortedMilestones.map((m, i) => ({
                milestone: m,
                displayStatus: getMilestoneDisplayStatus(
                  m,
                  campaign,
                  i > 0 ? sortedMilestones[i - 1] : null,
                ),
              }));

              return (
                <RowGroup key={campaign.id}>
                  {/* Collapsed row */}
                  <tr
                    className={cn(
                      'border-b cursor-pointer transition-colors hover:bg-muted/30',
                      isExpanded && 'bg-muted/20',
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : campaign.id); }}}
                  >
                    <td className="px-4 py-3">
                      {isExpanded ? (
                        <ChevronDownIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{campaign.title}</div>
                      <div className="text-xs text-muted-foreground">{campaign.documentCount} docs</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-sm">{campaign.creatorName || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{campaign.creatorEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('text-xs', verifConfig.className)}>
                        {verifConfig.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        {milestoneStatuses.map(({ displayStatus }, i) => {
                          const colors = MILESTONE_DISPLAY_COLORS[displayStatus];
                          return (
                            <span
                              key={i}
                              className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium', colors.bg, colors.text)}
                              title={`M${i + 1}: ${MILESTONE_DISPLAY_LABELS[displayStatus]}`}
                            >
                              <span className={cn('size-1.5 rounded-full', colors.dot)} />
                              M{i + 1}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {new Date(campaign.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>

                  {/* Expanded content */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <div className="border-b bg-muted/10 p-4 sm:p-6 space-y-6">
                          {/* Identity Verification Section */}
                          <section>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <ShieldCheckIcon className="size-4 text-teal-600 dark:text-teal-400" />
                              Identity Verification
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <dt className="text-muted-foreground text-xs">Provider</dt>
                                <dd className="font-medium">Veriff</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">Status</dt>
                                <dd>
                                  <Badge className={cn('text-xs', verifConfig.className)}>
                                    {verifConfig.label}
                                  </Badge>
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">Session ID</dt>
                                <dd className="font-mono text-xs truncate" title={campaign.veriffSessionId || undefined}>
                                  {campaign.veriffSessionId
                                    ? `${campaign.veriffSessionId.slice(0, 12)}...`
                                    : 'N/A'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">Reviewed</dt>
                                <dd>
                                  {campaign.verificationReviewedAt
                                    ? new Date(campaign.verificationReviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                    : 'Pending'}
                                </dd>
                              </div>
                            </div>
                            {campaign.verificationNotes && (
                              <div className="mt-3">
                                <dt className="text-muted-foreground text-xs mb-1">Notes</dt>
                                <dd className="text-sm bg-muted rounded-md p-2">{campaign.verificationNotes}</dd>
                              </div>
                            )}
                          </section>

                          {/* Milestone Sections */}
                          {milestoneStatuses.map(({ milestone, displayStatus }, _idx) => {
                            const colors = MILESTONE_DISPLAY_COLORS[displayStatus];
                            const phase = milestone.phase;
                            const isM1 = phase === 1;
                            const phaseLabel = isM1
                              ? 'No documents required'
                              : `Proof of Milestone ${phase - 1}`;

                            return (
                              <section key={milestone.id} className="border-t pt-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium', colors.bg, colors.text)}>
                                      <span className={cn('size-1.5 rounded-full', colors.dot)} />
                                      {MILESTONE_DISPLAY_LABELS[displayStatus]}
                                    </span>
                                    Milestone {phase}: {milestone.title}
                                  </h3>
                                  <span className="text-xs text-muted-foreground">{phaseLabel}</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <dt className="text-muted-foreground text-xs">Fund Allocation</dt>
                                    <dd className="font-mono font-medium">
                                      {milestone.fundPercentage != null ? `${milestone.fundPercentage}%` : 'N/A'}
                                      {milestone.fundAmount != null && (
                                        <span className="text-muted-foreground ml-1">
                                          (${(milestone.fundAmount / 100).toLocaleString()})
                                        </span>
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground text-xs">Released</dt>
                                    <dd className="font-mono font-medium">
                                      {milestone.releasedAmount != null
                                        ? `$${(milestone.releasedAmount / 100).toLocaleString()}`
                                        : '$0'}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground text-xs">Release Date</dt>
                                    <dd>
                                      {milestone.releasedAt
                                        ? new Date(milestone.releasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'Not released'}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground text-xs">Evidence Files</dt>
                                    <dd>{milestone.evidenceCount} file{milestone.evidenceCount !== 1 ? 's' : ''}</dd>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {/* View Documents */}
                                  {milestone.evidenceCount > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        fetchDocuments(campaign.id, phase, milestone.title);
                                      }}
                                    >
                                      <EyeIcon className="size-3.5" />
                                      View Docs ({milestone.evidenceCount})
                                    </Button>
                                  )}

                                  {/* Approve M1 (identity-only) */}
                                  {isM1 && displayStatus === 'eligible' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReviewDialog({
                                          campaignId: campaign.id,
                                          phase,
                                          action: 'approve',
                                          milestoneTitle: milestone.title,
                                        });
                                      }}
                                      className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950"
                                    >
                                      <CheckCircleIcon className="size-3.5" />
                                      Approve Release
                                    </Button>
                                  )}

                                  {/* Approve M2/M3 (evidence review) */}
                                  {!isM1 && displayStatus === 'under_review' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReviewDialog({
                                            campaignId: campaign.id,
                                            phase,
                                            action: 'approve',
                                            milestoneTitle: milestone.title,
                                          });
                                        }}
                                        className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950"
                                      >
                                        <CheckCircleIcon className="size-3.5" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReviewDialog({
                                            campaignId: campaign.id,
                                            phase,
                                            action: 'reject',
                                            milestoneTitle: milestone.title,
                                          });
                                        }}
                                        className="text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                                      >
                                        <XCircleIcon className="size-3.5" />
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </section>
                            );
                          })}

                          {/* Empty milestones state */}
                          {campaign.milestones.length === 0 && (
                            <div className="text-sm text-muted-foreground text-center py-4">
                              <InformationCircleIcon className="size-5 mx-auto mb-1 opacity-50" />
                              No milestones defined for this campaign
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  {search || statusFilter ? 'No campaigns match your filters' : 'No campaigns in verification queue'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  size="sm"
                  variant={pageNum === page ? 'default' : 'outline'}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={(v) => !v && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === 'approve' ? 'Approve' : 'Reject'} Phase {reviewDialog?.phase}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog?.milestoneTitle}
            </DialogDescription>
          </DialogHeader>

          {reviewDialog?.action === 'approve' && reviewDialog.phase === 1 && (
            <div className="rounded-md bg-teal-50 dark:bg-teal-950 p-3 text-sm text-teal-700 dark:text-teal-300">
              <p className="font-medium mb-1">Identity-only approval</p>
              <p>Phase 1 does not require document evidence. Approval is based on identity verification (Veriff) status.</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">
              Notes {reviewDialog?.action === 'reject' ? '(required)' : '(optional)'}
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={
                reviewDialog?.action === 'reject'
                  ? 'Explain why the evidence is being rejected...'
                  : 'Optional notes...'
              }
              className="mt-1 w-full text-sm border rounded-md p-2 bg-background resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewDialog(null); setReviewNotes(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewLoading || (reviewDialog?.action === 'reject' && !reviewNotes.trim())}
              variant={reviewDialog?.action === 'reject' ? 'destructive' : 'default'}
            >
              {reviewLoading
                ? 'Processing...'
                : reviewDialog?.action === 'approve'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Modal */}
      {docViewer && (
        <DocumentViewerModal
          documents={docViewer.documents}
          initialIndex={docViewer.initialIndex}
          open={true}
          onClose={() => setDocViewer(null)}
          title={docViewer.title}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={cn('rounded-lg p-3', className)}>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
