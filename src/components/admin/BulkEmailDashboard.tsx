'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatRelativeTime } from '@/lib/utils/dates';
import { toast } from 'sonner';
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

interface BulkEmailItem {
  id: string;
  templateName: string;
  subject: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  campaignId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  sending: 'secondary',
  completed: 'default',
  failed: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sending: 'Sending…',
  completed: 'Completed',
  failed: 'Failed',
};

const TEMPLATE_LABELS: Record<string, string> = {
  campaign_cancelled_refund: 'Campaign Cancelled - Full Refund',
  campaign_paused_update: 'Campaign Paused - Status Update',
  campaign_resumed_update: 'Campaign Resumed - Good News',
  campaign_completed_thanks: 'Campaign Completed - Thank You',
  custom: 'Custom Template',
};

export function BulkEmailDashboard() {
  const [items, setItems] = useState<BulkEmailItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<BulkEmailItem | null>(null);

  const fetchData = useCallback(async (page: number, status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'all') params.set('status', status);

      const res = await fetch(`/api/v1/admin/bulk-emails?${params}`);
      const data = await res.json();
      if (data.ok) {
        setItems(data.data.items);
        setPagination(data.data.pagination);
      } else {
        toast.error('Failed to load communications');
      }
    } catch {
      toast.error('Network error loading communications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(pagination.page, statusFilter);
  }, [fetchData, pagination.page, statusFilter]);

  async function handleSend(item: BulkEmailItem) {
    setSendingId(item.id);
    try {
      const res = await fetch(`/api/v1/admin/bulk-emails/${item.id}/send`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast.success(`"${item.subject}" is now sending`);
        fetchData(pagination.page, statusFilter);
      } else {
        toast.error(data.error?.message ?? 'Failed to send');
      }
    } catch {
      toast.error('Network error sending bulk email');
    } finally {
      setSendingId(null);
      setConfirmTarget(null);
    }
  }

  const displayed = search.trim()
    ? items.filter((item) => {
        const q = search.toLowerCase();
        return (
          item.subject.toLowerCase().includes(q) ||
          item.templateName.toLowerCase().includes(q)
        );
      })
    : items;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by subject or template…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search communications"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, page: 1 })); }}>
          <SelectTrigger className="w-40 bg-background">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="py-16 text-center">
          <EnvelopeIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">No bulk emails found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Template</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Subject</th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">Recipients</th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">Sent</th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">Failed</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="hidden px-4 py-3 text-xs font-medium text-muted-foreground lg:table-cell">Created</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {TEMPLATE_LABELS[item.templateName] ?? item.templateName}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                    {item.subject}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                    {item.recipientCount}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                    {item.sentCount}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                    {item.failedCount > 0 ? (
                      <span className="text-destructive">{item.failedCount}</span>
                    ) : (
                      item.failedCount
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[item.status] ?? 'outline'}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                    {item.status === 'sending' && item.recipientCount > 0 && (
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all"
                          style={{ width: `${Math.round(((item.sentCount + item.failedCount) / item.recipientCount) * 100)}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatRelativeTime(item.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={sendingId === item.id}
                        onClick={() => setConfirmTarget(item)}
                      >
                        {sendingId === item.id ? 'Sending…' : 'Send'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              <ChevronLeftIcon className="mr-1 h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Send confirmation dialog */}
      <Dialog open={!!confirmTarget} onOpenChange={() => setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Bulk Email</DialogTitle>
            <DialogDescription>
              Send &ldquo;{confirmTarget?.subject}&rdquo; to {confirmTarget?.recipientCount} recipient(s). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button onClick={() => confirmTarget && handleSend(confirmTarget)} disabled={sendingId === confirmTarget?.id}>
              {sendingId === confirmTarget?.id ? 'Sending…' : 'Send Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
