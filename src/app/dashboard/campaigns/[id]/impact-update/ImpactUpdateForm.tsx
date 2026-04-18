'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';
import DOMPurify from 'dompurify';

interface ExistingUpdate {
  id: string;
  title: string | null;
  bodyHtml: string | null;
  photos: string[];
  receiptUrls: string[];
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  dueDate: string | null;
}

interface ImpactUpdateFormProps {
  campaignId: string;
  existing: ExistingUpdate | null;
}

const STATUS_UI: Record<string, { icon: typeof CheckCircleIcon; label: string; className: string }> = {
  approved: { icon: CheckCircleIcon, label: 'Approved', className: 'text-emerald-600 dark:text-emerald-400' },
  submitted: { icon: ClockIcon, label: 'Under review', className: 'text-blue-600 dark:text-blue-400' },
  rejected: { icon: XCircleIcon, label: 'Changes requested', className: 'text-red-600 dark:text-red-400' },
  pending: { icon: ClockIcon, label: 'Not yet submitted', className: 'text-muted-foreground' },
  overdue: { icon: XCircleIcon, label: 'Overdue', className: 'text-red-600 dark:text-red-400' },
};

export function ImpactUpdateForm({ campaignId, existing }: ImpactUpdateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const _canSubmit = !existing || existing.status === 'rejected';
  const statusConfig = existing ? STATUS_UI[existing.status] ?? STATUS_UI.pending : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!title.trim() || !body.trim()) {
      setError('Title and description are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('body', body.trim());
    for (const file of photos) formData.append('photos', file);
    for (const file of receipts) formData.append('receipts', file);

    try {
      const res = await fetch(`/api/v1/user-campaigns/${campaignId}/impact-update`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to submit impact update.');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Show status + content if already submitted/approved
  if (existing && existing.status !== 'rejected') {
    const StatusIcon = statusConfig?.icon ?? ClockIcon;

    return (
      <div className="mt-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusConfig?.className}`} />
            <span className={`text-sm font-medium ${statusConfig?.className}`}>
              {statusConfig?.label}
            </span>
          </div>

          {existing.title && (
            <h3 className="mt-3 text-sm font-semibold text-foreground">{existing.title}</h3>
          )}

          {existing.bodyHtml && (
            <div
              className="prose prose-sm prose-neutral mt-2 max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(existing.bodyHtml) }}
            />
          )}

          {existing.photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {existing.photos.map((url, i) => (
                <a key={i} href={url} className="block overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} loading="lazy" className="h-auto w-full object-cover" />
                </a>
              ))}
            </div>
          )}

          {existing.receiptUrls.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground">{existing.receiptUrls.length} receipt(s) attached</p>
            </div>
          )}

          {existing.submittedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Submitted {new Date(existing.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show form for first submission or resubmission after rejection
  return (
    <div className="mt-6">
      {existing?.status === 'rejected' && existing.reviewerNotes && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">Changes requested</p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{existing.reviewerNotes}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="impact-title" className="block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="impact-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How the funds helped"
            maxLength={200}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="impact-body" className="block text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="impact-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tell your supporters how their donations were used. Be specific about what was purchased, accomplished, or changed."
            rows={6}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="impact-photos" className="block text-sm font-medium text-foreground">
            Photos
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">Show the impact. JPEG, PNG, or WebP. Up to 10MB each.</p>
          <input
            id="impact-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            className="mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
          />
          {photos.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{photos.length} file(s) selected</p>
          )}
        </div>

        <div>
          <label htmlFor="impact-receipts" className="block text-sm font-medium text-foreground">
            Receipts (optional)
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">Upload receipts showing how funds were spent. JPEG, PNG, WebP, or PDF.</p>
          <input
            id="impact-receipts"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={(e) => setReceipts(Array.from(e.target.files ?? []))}
            className="mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
          />
          {receipts.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{receipts.length} file(s) selected</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Impact Update'}
        </button>
      </form>
    </div>
  );
}
