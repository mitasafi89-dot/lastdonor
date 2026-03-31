'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  DocumentTextIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ViewerDocument {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  status: string; // pending | approved | rejected
  reviewerNotes: string | null;
  description?: string | null;
}

interface DocumentViewerModalProps {
  documents: ViewerDocument[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  onApprove?: (docId: string) => void;
  onReject?: (docId: string, notes: string) => void;
  title?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isImageMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith('image/');
}

function isPdfMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime === 'application/pdf';
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function DocumentViewerModal({
  documents,
  initialIndex = 0,
  open,
  onClose,
  onApprove,
  onReject,
  title = 'Document Viewer',
}: DocumentViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRejectingId(null);
      setRejectNotes('');
    }
  }, [open, initialIndex]);

  const doc = documents[currentIndex];
  const total = documents.length;

  const goTo = useCallback(
    (dir: -1 | 1) => {
      setCurrentIndex((i) => {
        const next = i + dir;
        if (next < 0 || next >= total) return i;
        return next;
      });
      setZoom(1);
    },
    [total],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, goTo]);

  if (!doc) return null;

  const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
  const isImage = isImageMime(doc.mimeType);
  const isPdf = isPdfMime(doc.mimeType);

  const handleRejectSubmit = () => {
    if (rejectingId && rejectNotes.trim() && onReject) {
      onReject(rejectingId, rejectNotes.trim());
      setRejectingId(null);
      setRejectNotes('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">
                {currentIndex + 1} of {total} &middot; {doc.fileName}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Body: viewer + sidebar */}
        <div className="flex flex-1 min-h-0">
          {/* Main viewer area */}
          <div className="flex-1 relative flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 min-h-0 overflow-hidden">
            {/* Navigation arrows */}
            {total > 1 && (
              <>
                <button
                  onClick={() => goTo(-1)}
                  disabled={currentIndex === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                  aria-label="Previous document"
                >
                  <ArrowLeftIcon className="size-5" />
                </button>
                <button
                  onClick={() => goTo(1)}
                  disabled={currentIndex === total - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                  aria-label="Next document"
                >
                  <ArrowRightIcon className="size-5" />
                </button>
              </>
            )}

            {/* Document display */}
            <div className="flex-1 w-full overflow-auto flex items-center justify-center p-4">
              {isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.fileUrl}
                  alt={doc.fileName}
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoom})` }}
                  draggable={false}
                />
              )}
              {isPdf && (
                <iframe
                  src={doc.fileUrl}
                  title={doc.fileName}
                  className="w-full h-full border-0 rounded"
                />
              )}
              {!isImage && !isPdf && (
                <div className="text-center text-muted-foreground">
                  <DocumentTextIcon className="size-16 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">{doc.fileName}</p>
                  <p className="text-sm mt-1">{doc.mimeType || 'Unknown type'}</p>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 dark:text-teal-400 underline text-sm mt-3 inline-block"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
            </div>

            {/* Zoom controls (images only) */}
            {isImage && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 rounded-full px-3 py-1.5 shadow-md">
                <button
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  aria-label="Zoom out"
                >
                  <MagnifyingGlassMinusIcon className="size-4" />
                </button>
                <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  aria-label="Zoom in"
                >
                  <MagnifyingGlassPlusIcon className="size-4" />
                </button>
              </div>
            )}
          </div>

          {/* Sidebar: file info + actions */}
          <div className="w-72 border-l shrink-0 overflow-y-auto bg-background">
            <div className="p-4 space-y-4">
              {/* File info */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">File Info</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium truncate" title={doc.fileName}>{doc.fileName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="flex items-center gap-1.5">
                      {isImage ? (
                        <PhotoIcon className="size-3.5 text-blue-500" />
                      ) : (
                        <DocumentTextIcon className="size-3.5 text-amber-500" />
                      )}
                      {doc.mimeType || 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Size</dt>
                    <dd>{formatFileSize(doc.fileSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Uploaded</dt>
                    <dd>{new Date(doc.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Badge className={cn('text-xs', statusConfig.className)}>{statusConfig.label}</Badge>
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Description */}
              {doc.description && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</h3>
                  <p className="text-sm">{doc.description}</p>
                </div>
              )}

              {/* Reviewer notes */}
              {doc.reviewerNotes && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Reviewer Notes</h3>
                  <p className="text-sm bg-muted rounded-md p-2">{doc.reviewerNotes}</p>
                </div>
              )}

              {/* Actions (when callbacks are provided and document is pending) */}
              {doc.status === 'pending' && (onApprove || onReject) && (
                <div className="pt-2 border-t space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Actions</h3>

                  {rejectingId === doc.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        placeholder="Reason for rejection (required)"
                        className="w-full text-sm border rounded-md p-2 bg-background resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleRejectSubmit}
                          disabled={!rejectNotes.trim()}
                          className="flex-1"
                        >
                          Confirm Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectingId(null); setRejectNotes(''); }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {onApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onApprove(doc.id)}
                          className="flex-1 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950"
                        >
                          <CheckCircleIcon className="size-4" />
                          Approve
                        </Button>
                      )}
                      {onReject && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectingId(doc.id)}
                          className="flex-1 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <XCircleIcon className="size-4" />
                          Reject
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* External link */}
              <div className="pt-2 border-t">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Open in new tab
                </a>
              </div>
            </div>

            {/* File list (thumbnail strip) */}
            {total > 1 && (
              <div className="border-t p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  All Files ({total})
                </h3>
                <div className="space-y-1">
                  {documents.map((d, i) => {
                    const st = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
                    return (
                      <button
                        key={d.id}
                        onClick={() => { setCurrentIndex(i); setZoom(1); }}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors',
                          i === currentIndex
                            ? 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300'
                            : 'hover:bg-muted',
                        )}
                      >
                        {isImageMime(d.mimeType) ? (
                          <PhotoIcon className="size-3.5 shrink-0" />
                        ) : (
                          <DocumentTextIcon className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate flex-1">{d.fileName}</span>
                        <span className={cn('size-2 rounded-full shrink-0', st.className.includes('green') ? 'bg-green-500' : st.className.includes('red') ? 'bg-red-500' : 'bg-gray-400')} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
