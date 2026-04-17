'use client';

import { CheckCircleIcon, ClockIcon, PhotoIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { sanitizeHtml } from '@/lib/utils/sanitize';

interface ImpactUpdateProps {
  impactUpdate: {
    title: string | null;
    bodyHtml: string | null;
    photos: string[];
    receiptUrls: string[];
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircleIcon; className: string }> = {
  approved: {
    label: 'Verified by LastDonor',
    icon: CheckCircleIcon,
    className: 'text-emerald-700 dark:text-emerald-300',
  },
  submitted: {
    label: 'Under review',
    icon: ClockIcon,
    className: 'text-muted-foreground',
  },
};

export function ImpactUpdate({ impactUpdate }: ImpactUpdateProps) {
  const config = STATUS_CONFIG[impactUpdate.status];
  if (!config) return null; // Don't show pending/rejected/overdue to public

  const StatusIcon = config.icon;

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-foreground">
        Impact Update
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        How the funds from this campaign were used.
      </p>

      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${config.className}`} />
          <span className={`text-sm font-medium ${config.className}`}>
            {config.label}
          </span>
          {impactUpdate.reviewedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(impactUpdate.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Title + body */}
        {impactUpdate.title && (
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            {impactUpdate.title}
          </h3>
        )}

        {impactUpdate.bodyHtml && (
          <div
            className="prose prose-sm prose-neutral mt-2 max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(impactUpdate.bodyHtml) }}
          />
        )}

        {/* Photos */}
        {impactUpdate.photos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {impactUpdate.photos.map((url, i) => (
              <a key={i} href={url} className="block overflow-hidden rounded-md border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Impact photo ${i + 1}`}
                  loading="lazy"
                  className="h-auto w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}

        {/* Receipts */}
        {impactUpdate.receiptUrls.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-foreground">Receipts</p>
            {impactUpdate.receiptUrls.map((url, i) => {
              const fileName = url.split('/').pop() ?? `Receipt ${i + 1}`;
              const isImage = /\.(jpe?g|png|webp)$/i.test(url);

              return isImage ? (
                <a key={i} href={url} className="block overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Receipt ${i + 1}`}
                    loading="lazy"
                    className="h-auto max-h-48 w-full object-cover"
                  />
                  <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                    <PhotoIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fileName}</span>
                  </span>
                </a>
              ) : (
                <a
                  key={i}
                  href={url}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  <DocumentIcon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{fileName}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
