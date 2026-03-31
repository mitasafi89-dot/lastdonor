'use client';

import { useState, useMemo, useCallback, Fragment } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  computeMilestoneDisplayStatus,
  computeRiskFlags,
  getPrerequisiteStatus,
  isEligibleForRelease,
  MILESTONE_DISPLAY_LABELS,
  MILESTONE_DISPLAY_COLORS,
  type MilestoneData,
  type FundReleaseData,
  type CampaignVerificationData,
  type RiskFlag,
} from '@/lib/milestone-status';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  FlagIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ClockIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MilestoneItem {
  id: string;
  phase: number;
  title: string;
  description: string | null;
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
    notes: string | null;
    flaggedForAudit: boolean;
    flagReason: string | null;
    pauseReason: string | null;
    createdAt: string;
  } | null;
}

interface AuditEntry {
  id: string;
  eventType: string;
  actorId: string | null;
  details: Record<string, unknown> | null;
  severity: string;
  timestamp: string;
}

interface CampaignItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  verificationStatus: string;
  goalAmount: number;
  raisedAmount: number;
  totalReleasedAmount: number;
  milestoneFundRelease: boolean;
  creatorId: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  updatedAt: string;
  milestones: MilestoneItem[];
  auditTrail: AuditEntry[];
}

interface Stats {
  totalEvidenceSubmitted: number;
  totalApproved: number;
  totalRejected: number;
  totalPending: number;
  totalReached: number;
}

interface FundReleaseDashboardProps {
  initialCampaigns: CampaignItem[];
  stats: Stats;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const FILTER_OPTIONS = [
  { value: '', label: 'All Campaigns' },
  { value: 'needs_action', label: 'Needs Action' },
  { value: 'flagged', label: 'Flagged for Audit' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'all_released', label: 'All Funds Released' },
];

const RISK_FLAG_ICONS: Record<RiskFlag['type'], typeof ExclamationTriangleIcon> = {
  rejected_milestone: ExclamationTriangleIcon,
  flagged_release: FlagIcon,
  paused_release: PauseCircleIcon,
  verification_issue: ShieldExclamationIcon,
  overdue: ClockIcon,
};

const RISK_FLAG_COLORS: Record<RiskFlag['type'], string> = {
  rejected_milestone: 'text-red-500',
  flagged_release: 'text-red-500',
  paused_release: 'text-orange-500',
  verification_issue: 'text-red-600',
  overdue: 'text-amber-500',
};

const AUDIT_EVENT_LABELS: Record<string, string> = {
  'fund_release.paused': 'Release placed on hold',
  'fund_release.resumed': 'Release resumed',
  'fund_release.flagged': 'Flagged for audit',
  'fund_release.unflagged': 'Audit flag removed',
  'fund_release.note_added': 'Admin note added',
  'milestone.approved': 'Milestone approved',
  'milestone.rejected': 'Milestone rejected',
  'fund_release.approved': 'Fund release approved',
  'fund_release.released': 'Funds disbursed',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function FundReleaseDashboard({ initialCampaigns, stats: _stats }: FundReleaseDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  // Action dialogs
  const [releaseDialog, setReleaseDialog] = useState<{
    campaignId: string;
    phase: number;
    milestoneTitle: string;
    milestoneId: string;
  } | null>(null);
  const [holdDialog, setHoldDialog] = useState<{
    campaignId: string;
    releaseId: string;
    action: 'hold' | 'resume';
    phase: number;
  } | null>(null);
  const [flagDialog, setFlagDialog] = useState<{
    campaignId: string;
    releaseId: string;
    action: 'flag' | 'unflag';
    phase: number;
  } | null>(null);
  const [noteDialog, setNoteDialog] = useState<{
    campaignId: string;
    releaseId: string;
    phase: number;
  } | null>(null);

  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Helpers ─────────────────────────────────────────────────────────

  const getMilestoneHelpers = useCallback(
    (campaign: CampaignItem) => {
      const sorted = [...campaign.milestones].sort((a, b) => a.phase - b.phase);
      const campaignVerif: CampaignVerificationData = {
        verificationStatus: campaign.verificationStatus,
      };

      return sorted.map((m, i) => {
        const milestoneData: MilestoneData = {
          id: m.id,
          phase: m.phase,
          title: m.title,
          status: m.status,
          fundPercentage: m.fundPercentage,
          fundAmount: m.fundAmount,
          releasedAmount: m.releasedAmount,
          releasedAt: m.releasedAt,
        };
        const releaseData: FundReleaseData | null = m.fundRelease
          ? {
              id: m.fundRelease.id,
              milestoneId: m.id,
              amount: m.fundRelease.amount,
              status: m.fundRelease.status,
              approvedBy: m.fundRelease.approvedBy,
              approvedAt: m.fundRelease.approvedAt,
              releasedAt: m.fundRelease.releasedAt,
              notes: m.fundRelease.notes,
              flaggedForAudit: m.fundRelease.flaggedForAudit,
              flagReason: m.fundRelease.flagReason,
              pauseReason: m.fundRelease.pauseReason,
            }
          : null;
        const prevData: MilestoneData | null =
          i > 0
            ? {
                id: sorted[i - 1].id,
                phase: sorted[i - 1].phase,
                title: sorted[i - 1].title,
                status: sorted[i - 1].status,
                fundPercentage: sorted[i - 1].fundPercentage,
                fundAmount: sorted[i - 1].fundAmount,
                releasedAmount: sorted[i - 1].releasedAmount,
                releasedAt: sorted[i - 1].releasedAt,
              }
            : null;

        const displayStatus = computeMilestoneDisplayStatus(
          milestoneData,
          campaignVerif,
          releaseData,
          prevData,
        );
        const eligibility = isEligibleForRelease(
          m.phase,
          milestoneData,
          campaignVerif,
          prevData,
          releaseData,
        );
        const prerequisites = getPrerequisiteStatus(
          m.phase,
          milestoneData,
          campaignVerif,
          prevData,
        );

        return {
          milestone: m,
          milestoneData,
          releaseData,
          displayStatus,
          eligibility,
          prerequisites,
        };
      });
    },
    [],
  );

  const getCampaignRiskFlags = useCallback(
    (campaign: CampaignItem) => {
      const campaignVerif: CampaignVerificationData = {
        verificationStatus: campaign.verificationStatus,
      };
      const milestones: MilestoneData[] = campaign.milestones.map((m) => ({
        id: m.id,
        phase: m.phase,
        title: m.title,
        status: m.status,
        fundPercentage: m.fundPercentage,
        fundAmount: m.fundAmount,
        releasedAmount: m.releasedAmount,
        releasedAt: m.releasedAt,
      }));
      const releases: FundReleaseData[] = campaign.milestones
        .filter((m) => m.fundRelease)
        .map((m) => ({
          id: m.fundRelease!.id,
          milestoneId: m.id,
          amount: m.fundRelease!.amount,
          status: m.fundRelease!.status,
          approvedBy: m.fundRelease!.approvedBy,
          approvedAt: m.fundRelease!.approvedAt,
          releasedAt: m.fundRelease!.releasedAt,
          notes: m.fundRelease!.notes,
          flaggedForAudit: m.fundRelease!.flaggedForAudit,
          flagReason: m.fundRelease!.flagReason,
          pauseReason: m.fundRelease!.pauseReason,
        }));
      return computeRiskFlags(campaignVerif, milestones, releases);
    },
    [],
  );

  // ─── Filtering & Pagination ────────────────────────────────────────

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
      items = items.filter((c) => {
        const riskFlags = getCampaignRiskFlags(c);
        const helpers = getMilestoneHelpers(c);
        switch (statusFilter) {
          case 'needs_action':
            return helpers.some(
              (h) => h.displayStatus === 'eligible' || h.displayStatus === 'under_review',
            );
          case 'flagged':
            return riskFlags.some((f) => f.type === 'flagged_release');
          case 'on_hold':
            return riskFlags.some((f) => f.type === 'paused_release');
          case 'all_released':
            return helpers.every(
              (h) => h.displayStatus === 'released' || h.displayStatus === 'not_started',
            );
          default:
            return true;
        }
      });
    }

    return items;
  }, [campaigns, search, statusFilter, getCampaignRiskFlags, getMilestoneHelpers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  // ─── Actions ───────────────────────────────────────────────────────

  const handleRelease = useCallback(
    async () => {
      if (!releaseDialog) return;
      const { campaignId, phase } = releaseDialog;

      setActionLoading(true);
      try {
        const res = await fetch(
          `/api/v1/admin/campaigns/${campaignId}/milestones/${phase}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', notes: actionReason || undefined }),
          },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || 'Failed to approve release');
        }
        const data = await res.json();

        setCampaigns((prev) =>
          prev.map((c) => {
            if (c.id !== campaignId) return c;
            return {
              ...c,
              totalReleasedAmount:
                c.totalReleasedAmount + (data.data.releaseAmount ?? 0),
              milestones: c.milestones.map((m) => {
                if (m.phase !== phase) return m;
                return {
                  ...m,
                  status: data.data.milestoneStatus,
                  releasedAmount: data.data.releaseAmount ?? m.releasedAmount,
                  releasedAt: new Date().toISOString(),
                  fundRelease: {
                    id: 'optimistic',
                    amount: data.data.releaseAmount ?? 0,
                    status: 'approved',
                    approvedBy: null,
                    approvedAt: new Date().toISOString(),
                    releasedAt: null,
                    notes: actionReason || null,
                    flaggedForAudit: false,
                    flagReason: null,
                    pauseReason: null,
                    createdAt: new Date().toISOString(),
                  },
                };
              }),
            };
          }),
        );

        toast.success(
          `Phase ${phase} approved - $${((data.data.releaseAmount ?? 0) / 100).toLocaleString()} released`,
        );
        setReleaseDialog(null);
        setActionReason('');
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [releaseDialog, actionReason],
  );

  const handleHold = useCallback(
    async () => {
      if (!holdDialog) return;
      const { campaignId, releaseId, action, phase } = holdDialog;

      if (action === 'hold' && !actionReason.trim()) {
        toast.error('A reason is required to place a release on hold');
        return;
      }

      setActionLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/fund-releases/${releaseId}/hold`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason: actionReason || undefined }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || `Failed to ${action} release`);
        }

        setCampaigns((prev) =>
          prev.map((c) => {
            if (c.id !== campaignId) return c;
            return {
              ...c,
              milestones: c.milestones.map((m) => {
                if (!m.fundRelease || m.fundRelease.id !== releaseId) return m;
                return {
                  ...m,
                  fundRelease: {
                    ...m.fundRelease,
                    status: action === 'hold' ? 'paused' : 'approved',
                    pauseReason: action === 'hold' ? actionReason : null,
                  },
                };
              }),
            };
          }),
        );

        toast.success(
          action === 'hold'
            ? `Phase ${phase} release placed on hold`
            : `Phase ${phase} release resumed`,
        );
        setHoldDialog(null);
        setActionReason('');
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [holdDialog, actionReason],
  );

  const handleFlag = useCallback(
    async () => {
      if (!flagDialog) return;
      const { campaignId, releaseId, action, phase } = flagDialog;

      if (action === 'flag' && !actionReason.trim()) {
        toast.error('A reason is required to flag a release for audit');
        return;
      }

      setActionLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/fund-releases/${releaseId}/flag`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason: actionReason || undefined }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || `Failed to ${action} release`);
        }

        setCampaigns((prev) =>
          prev.map((c) => {
            if (c.id !== campaignId) return c;
            return {
              ...c,
              milestones: c.milestones.map((m) => {
                if (!m.fundRelease || m.fundRelease.id !== releaseId) return m;
                return {
                  ...m,
                  fundRelease: {
                    ...m.fundRelease,
                    flaggedForAudit: action === 'flag',
                    flagReason: action === 'flag' ? actionReason : null,
                  },
                };
              }),
            };
          }),
        );

        toast.success(
          action === 'flag'
            ? `Phase ${phase} release flagged for audit`
            : `Phase ${phase} audit flag removed`,
        );
        setFlagDialog(null);
        setActionReason('');
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [flagDialog, actionReason],
  );

  const handleAddNote = useCallback(
    async () => {
      if (!noteDialog) return;
      const { campaignId, releaseId, phase } = noteDialog;

      if (!actionReason.trim()) {
        toast.error('Note text is required');
        return;
      }

      setActionLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/fund-releases/${releaseId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: actionReason }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || 'Failed to add note');
        }

        // Add optimistic audit entry
        setCampaigns((prev) =>
          prev.map((c) => {
            if (c.id !== campaignId) return c;
            return {
              ...c,
              auditTrail: [
                {
                  id: `optimistic-${Date.now()}`,
                  eventType: 'fund_release.note_added',
                  actorId: null,
                  details: { note: actionReason, milestonePhase: phase },
                  severity: 'info',
                  timestamp: new Date().toISOString(),
                },
                ...c.auditTrail,
              ],
            };
          }),
        );

        toast.success(`Note added to Phase ${phase}`);
        setNoteDialog(null);
        setActionReason('');
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [noteDialog, actionReason],
  );

  // ─── Render ────────────────────────────────────────────────────────

  // Compute totals for stats bar
  const totals = useMemo(() => {
    let totalRaised = 0;
    let totalReleased = 0;
    let totalHeld = 0;
    let totalFlagged = 0;
    for (const c of campaigns) {
      totalRaised += c.raisedAmount;
      totalReleased += c.totalReleasedAmount;
      for (const m of c.milestones) {
        if (m.fundRelease?.status === 'paused') totalHeld++;
        if (m.fundRelease?.flaggedForAudit) totalFlagged++;
      }
    }
    return { totalRaised, totalReleased, totalHeld, totalFlagged };
  }, [campaigns]);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Total Raised"
          value={`$${(totals.totalRaised / 100).toLocaleString()}`}
          className="bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300"
        />
        <StatTile
          label="Total Released"
          value={`$${(totals.totalReleased / 100).toLocaleString()}`}
          className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
        />
        <StatTile
          label="On Hold"
          value={String(totals.totalHeld)}
          className="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
        />
        <StatTile
          label="Flagged"
          value={String(totals.totalFlagged)}
          className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
        />
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
              <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">Raised</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Released</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Remaining</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Milestones</th>
              <th className="text-left font-medium px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {paginated.map((campaign) => {
              const isExpanded = expandedId === campaign.id;
              const helpers = getMilestoneHelpers(campaign);
              const riskFlags = getCampaignRiskFlags(campaign);
              const remaining = campaign.raisedAmount - campaign.totalReleasedAmount;

              return (
                <Fragment key={campaign.id}>
                  {/* Collapsed row */}
                  <tr
                    className={cn(
                      'border-b cursor-pointer transition-colors hover:bg-muted/30',
                      isExpanded && 'bg-muted/20',
                    )}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : campaign.id)
                    }
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : campaign.id);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      {isExpanded ? (
                        <ChevronDownIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{campaign.title}</span>
                        {riskFlags.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            {riskFlags.slice(0, 3).map((flag, i) => {
                              const Icon = RISK_FLAG_ICONS[flag.type];
                              return (
                                <Icon
                                  key={i}
                                  className={cn('size-4', RISK_FLAG_COLORS[flag.type])}
                                  title={flag.message}
                                />
                              );
                            })}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.creatorName || 'Unknown'} &middot;{' '}
                        {campaign.creatorEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="font-mono font-medium">
                        ${(campaign.raisedAmount / 100).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="font-mono font-medium text-green-700 dark:text-green-400">
                        ${(campaign.totalReleasedAmount / 100).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="font-mono font-medium">
                        ${(remaining / 100).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        {helpers.map(({ displayStatus }, i) => {
                          const colors =
                            MILESTONE_DISPLAY_COLORS[displayStatus];
                          return (
                            <span
                              key={i}
                              className={cn(
                                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
                                colors.bg,
                                colors.text,
                              )}
                              title={`M${i + 1}: ${MILESTONE_DISPLAY_LABELS[displayStatus]}`}
                            >
                              <span
                                className={cn(
                                  'size-1.5 rounded-full',
                                  colors.dot,
                                )}
                              />
                              M{i + 1}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {riskFlags.length > 0 && (
                        <Badge
                          className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs"
                          title={riskFlags.map((f) => f.message).join(', ')}
                        >
                          {riskFlags.length}
                        </Badge>
                      )}
                    </td>
                  </tr>

                  {/* Expanded content */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div className="border-b bg-muted/10 p-4 sm:p-6 space-y-6">
                          {/* Financial Summary */}
                          <section>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <CurrencyDollarIcon className="size-4 text-teal-600 dark:text-teal-400" />
                              Financial Summary
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <dt className="text-muted-foreground text-xs">
                                  Goal
                                </dt>
                                <dd className="font-mono font-medium">
                                  $
                                  {(
                                    campaign.goalAmount / 100
                                  ).toLocaleString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">
                                  Raised
                                </dt>
                                <dd className="font-mono font-medium">
                                  $
                                  {(
                                    campaign.raisedAmount / 100
                                  ).toLocaleString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">
                                  Total Released
                                </dt>
                                <dd className="font-mono font-medium text-green-700 dark:text-green-400">
                                  $
                                  {(
                                    campaign.totalReleasedAmount / 100
                                  ).toLocaleString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">
                                  Remaining Balance
                                </dt>
                                <dd className="font-mono font-medium">
                                  ${(remaining / 100).toLocaleString()}
                                </dd>
                              </div>
                            </div>
                          </section>

                          {/* Per-Milestone Detail */}
                          {helpers.map(
                            ({
                              milestone,
                              displayStatus,
                              eligibility,
                              prerequisites: _prerequisites,
                            }) => {
                              const colors =
                                MILESTONE_DISPLAY_COLORS[displayStatus];
                              const release = milestone.fundRelease;
                              const hasRelease = !!release;

                              return (
                                <section
                                  key={milestone.id}
                                  className="border-t pt-4"
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
                                          colors.bg,
                                          colors.text,
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            'size-1.5 rounded-full',
                                            colors.dot,
                                          )}
                                        />
                                        {
                                          MILESTONE_DISPLAY_LABELS[
                                            displayStatus
                                          ]
                                        }
                                      </span>
                                      Milestone {milestone.phase}:{' '}
                                      {milestone.title}
                                    </h3>

                                    {/* Three-dot action menu */}
                                    {hasRelease && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                            onClick={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            <EllipsisVerticalIcon className="size-4 text-muted-foreground" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {/* Hold / Resume */}
                                          {release.status === 'approved' && (
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActionReason('');
                                                setHoldDialog({
                                                  campaignId: campaign.id,
                                                  releaseId: release.id,
                                                  action: 'hold',
                                                  phase: milestone.phase,
                                                });
                                              }}
                                            >
                                              <PauseCircleIcon className="size-4 mr-2 text-orange-500" />
                                              Place on Hold
                                            </DropdownMenuItem>
                                          )}
                                          {release.status === 'paused' && (
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActionReason('');
                                                setHoldDialog({
                                                  campaignId: campaign.id,
                                                  releaseId: release.id,
                                                  action: 'resume',
                                                  phase: milestone.phase,
                                                });
                                              }}
                                            >
                                              <PlayCircleIcon className="size-4 mr-2 text-green-500" />
                                              Resume Release
                                            </DropdownMenuItem>
                                          )}

                                          {/* Flag / Unflag */}
                                          {!release.flaggedForAudit ? (
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActionReason('');
                                                setFlagDialog({
                                                  campaignId: campaign.id,
                                                  releaseId: release.id,
                                                  action: 'flag',
                                                  phase: milestone.phase,
                                                });
                                              }}
                                            >
                                              <FlagIcon className="size-4 mr-2 text-red-500" />
                                              Flag for Audit
                                            </DropdownMenuItem>
                                          ) : (
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActionReason('');
                                                setFlagDialog({
                                                  campaignId: campaign.id,
                                                  releaseId: release.id,
                                                  action: 'unflag',
                                                  phase: milestone.phase,
                                                });
                                              }}
                                            >
                                              <FlagIcon className="size-4 mr-2 text-muted-foreground" />
                                              Remove Audit Flag
                                            </DropdownMenuItem>
                                          )}

                                          <DropdownMenuSeparator />

                                          {/* Add Note */}
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActionReason('');
                                              setNoteDialog({
                                                campaignId: campaign.id,
                                                releaseId: release.id,
                                                phase: milestone.phase,
                                              });
                                            }}
                                          >
                                            <DocumentTextIcon className="size-4 mr-2" />
                                            Add Note
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>

                                  {/* Milestone financial detail */}
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                                    <div>
                                      <dt className="text-muted-foreground text-xs">
                                        Allocation
                                      </dt>
                                      <dd className="font-mono font-medium">
                                        {milestone.fundPercentage != null
                                          ? `${milestone.fundPercentage}%`
                                          : 'N/A'}
                                        {milestone.fundAmount != null && (
                                          <span className="text-muted-foreground ml-1">
                                            ($
                                            {(
                                              milestone.fundAmount / 100
                                            ).toLocaleString()}
                                            )
                                          </span>
                                        )}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground text-xs">
                                        Released
                                      </dt>
                                      <dd className="font-mono font-medium">
                                        {milestone.releasedAmount != null
                                          ? `$${(milestone.releasedAmount / 100).toLocaleString()}`
                                          : '$0'}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground text-xs">
                                        Release Date
                                      </dt>
                                      <dd>
                                        {milestone.releasedAt
                                          ? new Date(
                                              milestone.releasedAt,
                                            ).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric',
                                            })
                                          : 'Not released'}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground text-xs">
                                        Release Status
                                      </dt>
                                      <dd>
                                        {release ? (
                                          <Badge
                                            className={cn(
                                              'text-xs',
                                              release.status === 'released' || release.status === 'approved'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                : release.status === 'paused'
                                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                                            )}
                                          >
                                            {release.status}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            No release
                                          </span>
                                        )}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground text-xs">
                                        Evidence
                                      </dt>
                                      <dd>
                                        {milestone.evidenceCount} file
                                        {milestone.evidenceCount !== 1
                                          ? 's'
                                          : ''}
                                      </dd>
                                    </div>
                                  </div>

                                  {/* Flags & warnings */}
                                  {release?.flaggedForAudit && (
                                    <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950 p-2 text-sm text-red-700 dark:text-red-300">
                                      <FlagIcon className="size-4 mt-0.5 shrink-0" />
                                      <div>
                                        <span className="font-medium">
                                          Flagged for audit
                                        </span>
                                        {release.flagReason && (
                                          <p className="text-xs mt-0.5">
                                            {release.flagReason}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {release?.status === 'paused' && (
                                    <div className="mt-2 flex items-start gap-2 rounded-md bg-orange-50 dark:bg-orange-950 p-2 text-sm text-orange-700 dark:text-orange-300">
                                      <PauseCircleIcon className="size-4 mt-0.5 shrink-0" />
                                      <div>
                                        <span className="font-medium">
                                          On Hold
                                        </span>
                                        {release.pauseReason && (
                                          <p className="text-xs mt-0.5">
                                            {release.pauseReason}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Release action button */}
                                  {!hasRelease && eligibility.eligible && (
                                    <div className="mt-3">
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActionReason('');
                                          setReleaseDialog({
                                            campaignId: campaign.id,
                                            phase: milestone.phase,
                                            milestoneTitle: milestone.title,
                                            milestoneId: milestone.id,
                                          });
                                        }}
                                        className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950 bg-green-50 dark:bg-green-950"
                                      >
                                        <CheckCircleIcon className="size-3.5" />
                                        Release Funds
                                      </Button>
                                    </div>
                                  )}
                                  {!hasRelease &&
                                    !eligibility.eligible &&
                                    eligibility.missing.length > 0 &&
                                    displayStatus !== 'not_started' && (
                                      <div className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
                                        <InformationCircleIcon className="size-3.5 mt-0.5 shrink-0" />
                                        <span>
                                          Cannot release:{' '}
                                          {eligibility.missing.join('; ')}
                                        </span>
                                      </div>
                                    )}
                                </section>
                              );
                            },
                          )}

                          {/* Audit Trail */}
                          {campaign.auditTrail.length > 0 && (
                            <section className="border-t pt-4">
                              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <ClockIcon className="size-4 text-muted-foreground" />
                                Audit Trail
                              </h3>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {campaign.auditTrail.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="flex items-start gap-3 text-xs"
                                  >
                                    <span className="text-muted-foreground whitespace-nowrap font-mono">
                                      {new Date(
                                        entry.timestamp,
                                      ).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                      })}{' '}
                                      {new Date(
                                        entry.timestamp,
                                      ).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    <span
                                      className={cn(
                                        'font-medium',
                                        entry.severity === 'warning'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : entry.severity === 'error'
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-foreground',
                                      )}
                                    >
                                      {AUDIT_EVENT_LABELS[entry.eventType] ||
                                        entry.eventType}
                                    </span>
                                    {entry.details &&
                                      typeof entry.details === 'object' &&
                                      'note' in entry.details && (
                                        <span className="text-muted-foreground truncate max-w-xs">
                                          {String(
                                            (
                                              entry.details as {
                                                note?: string;
                                              }
                                            ).note || '',
                                          )}
                                        </span>
                                      )}
                                    {entry.details &&
                                      typeof entry.details === 'object' &&
                                      'reason' in entry.details && (
                                        <span className="text-muted-foreground truncate max-w-xs">
                                          {String(
                                            (
                                              entry.details as {
                                                reason?: string;
                                              }
                                            ).reason || '',
                                          )}
                                        </span>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Empty state */}
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
                </Fragment>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {search || statusFilter
                    ? 'No campaigns match your filters'
                    : 'No campaigns with milestone-based fund release'}
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
            Showing {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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

      {/* Release Confirmation Dialog */}
      <Dialog
        open={!!releaseDialog}
        onOpenChange={(v) => !v && setReleaseDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Release Funds - Phase {releaseDialog?.phase}
            </DialogTitle>
            <DialogDescription>
              {releaseDialog?.milestoneTitle}
            </DialogDescription>
          </DialogHeader>

          {/* Prerequisite checklist */}
          {releaseDialog && (() => {
            const campaign = campaigns.find(
              (c) => c.id === releaseDialog.campaignId,
            );
            if (!campaign) return null;
            const helpers = getMilestoneHelpers(campaign);
            const helper = helpers.find(
              (h) => h.milestone.phase === releaseDialog.phase,
            );
            if (!helper) return null;

            return (
              <div className="space-y-2">
                <p className="text-sm font-medium">Prerequisites</p>
                <ul className="space-y-1.5">
                  {helper.prerequisites.items.map((item, i) => (
                    <li
                      key={i}
                      className={cn(
                        'flex items-center gap-2 text-sm',
                        item.met
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {item.met ? (
                        <CheckCircleIcon className="size-4 shrink-0" />
                      ) : (
                        <ExclamationTriangleIcon className="size-4 shrink-0" />
                      )}
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {releaseDialog?.phase === 1 && (
            <div className="rounded-md bg-teal-50 dark:bg-teal-950 p-3 text-sm text-teal-700 dark:text-teal-300">
              <p className="font-medium mb-1">Identity-only approval</p>
              <p>
                Phase 1 does not require document evidence. Approval is based on
                identity verification (Veriff) status.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Optional notes for this release..."
              className="mt-1 w-full text-sm border rounded-md p-2 bg-background resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReleaseDialog(null);
                setActionReason('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRelease} disabled={actionLoading}>
              {actionLoading ? 'Processing...' : 'Confirm Release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold / Resume Dialog */}
      <Dialog
        open={!!holdDialog}
        onOpenChange={(v) => !v && setHoldDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {holdDialog?.action === 'hold' ? 'Place on Hold' : 'Resume Release'}{' '}
              - Phase {holdDialog?.phase}
            </DialogTitle>
            <DialogDescription>
              {holdDialog?.action === 'hold'
                ? 'This will pause the fund release process. Funds will not be disbursed until resumed.'
                : 'This will resume the fund release process.'}
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="text-sm font-medium">
              Reason {holdDialog?.action === 'hold' ? '(required)' : '(optional)'}
            </label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={
                holdDialog?.action === 'hold'
                  ? 'Explain why the release is being placed on hold...'
                  : 'Optional notes...'
              }
              className="mt-1 w-full text-sm border rounded-md p-2 bg-background resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setHoldDialog(null);
                setActionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleHold}
              disabled={
                actionLoading ||
                (holdDialog?.action === 'hold' && !actionReason.trim())
              }
              variant={holdDialog?.action === 'hold' ? 'destructive' : 'default'}
            >
              {actionLoading
                ? 'Processing...'
                : holdDialog?.action === 'hold'
                  ? 'Confirm Hold'
                  : 'Confirm Resume'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag / Unflag Dialog */}
      <Dialog
        open={!!flagDialog}
        onOpenChange={(v) => !v && setFlagDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {flagDialog?.action === 'flag'
                ? 'Flag for Audit'
                : 'Remove Audit Flag'}{' '}
              - Phase {flagDialog?.phase}
            </DialogTitle>
            <DialogDescription>
              {flagDialog?.action === 'flag'
                ? 'This will mark the fund release for audit review. The release status will not change.'
                : 'This will remove the audit flag from this release.'}
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="text-sm font-medium">
              Reason {flagDialog?.action === 'flag' ? '(required)' : '(optional)'}
            </label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={
                flagDialog?.action === 'flag'
                  ? 'Describe the reason for flagging this release...'
                  : 'Optional notes...'
              }
              className="mt-1 w-full text-sm border rounded-md p-2 bg-background resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFlagDialog(null);
                setActionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFlag}
              disabled={
                actionLoading ||
                (flagDialog?.action === 'flag' && !actionReason.trim())
              }
              variant={flagDialog?.action === 'flag' ? 'destructive' : 'default'}
            >
              {actionLoading
                ? 'Processing...'
                : flagDialog?.action === 'flag'
                  ? 'Confirm Flag'
                  : 'Remove Flag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog
        open={!!noteDialog}
        onOpenChange={(v) => !v && setNoteDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note - Phase {noteDialog?.phase}</DialogTitle>
            <DialogDescription>
              This note will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="text-sm font-medium">Note (required)</label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter your note..."
              className="mt-1 w-full text-sm border rounded-md p-2 bg-background resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNoteDialog(null);
                setActionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNote}
              disabled={actionLoading || !actionReason.trim()}
            >
              {actionLoading ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg p-3', className)}>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  );
}
