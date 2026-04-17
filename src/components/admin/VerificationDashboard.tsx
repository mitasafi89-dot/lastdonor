'use client';

import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

// --- Types ---

interface CampaignItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  verificationStatus: string;
  verificationNotes: string | null;
  verificationReviewedAt: string | null;
  stripeVerificationId: string | null;
  goalAmount: number;
  raisedAmount: number;
  totalReleasedAmount: number;
  creatorId: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
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

// --- Constants ---

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

// --- Component ---

export function VerificationDashboard({ initialCampaigns, stats }: VerificationDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const campaigns = initialCampaigns;

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

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

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
            aria-label="Search campaigns or creators"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <select
            value={statusFilter}
            aria-label="Filter by status"
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
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Docs</th>
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

              return (
                <RowGroup key={campaign.id}>
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
                      <div className="text-xs text-muted-foreground">{campaign.slug}</div>
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
                      <span className="text-sm">{campaign.documentCount} doc{campaign.documentCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {new Date(campaign.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>

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
                                <dd className="font-medium">Stripe Identity</dd>
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
                                <dd className="font-mono text-xs truncate" title={campaign.stripeVerificationId || undefined}>
                                  {campaign.stripeVerificationId
                                    ? `${campaign.stripeVerificationId.slice(0, 16)}...`
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

                          {/* Fund Release Status */}
                          <section className="border-t pt-4">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <InformationCircleIcon className="size-4 text-blue-600 dark:text-blue-400" />
                              Fund Release
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                              <div>
                                <dt className="text-muted-foreground text-xs">Raised</dt>
                                <dd className="font-mono font-medium">
                                  ${(campaign.raisedAmount / 100).toLocaleString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">Released</dt>
                                <dd className="font-mono font-medium text-green-700 dark:text-green-400">
                                  ${((campaign.totalReleasedAmount ?? 0) / 100).toLocaleString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-xs">Release Model</dt>
                                <dd className="text-sm">
                                  {campaign.verificationStatus === 'fully_verified'
                                    ? 'Lump-sum (released upon full verification)'
                                    : 'Pending full verification'}
                                </dd>
                              </div>
                            </div>
                          </section>
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
    </div>
  );
}

// --- Sub-components ---

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
