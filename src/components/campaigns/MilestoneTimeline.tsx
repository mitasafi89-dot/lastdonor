'use client';

import { CheckCircleIcon, ClockIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/24/solid';

interface EvidenceFile {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  reviewedAt: string | null;
}

interface Milestone {
  phase: number;
  status: string;
  title: string;
  description: string;
  fundPercentage: number;
  fundAmountFormatted: string;
  evidence?: EvidenceFile[];
}

interface MilestoneTimelineProps {
  milestones: Milestone[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  approved: {
    label: 'Funds Released',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  reached: {
    label: 'Milestone Reached',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  evidence_submitted: {
    label: 'Under Review',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  pending: {
    label: 'Upcoming',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  rejected: {
    label: 'Needs Attention',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  overdue: {
    label: 'Overdue',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (milestones.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-foreground">
        How Funds Are Released
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Donations are released in phases as the campaign creator meets verified milestones.
      </p>

      <div className="relative mt-5">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" aria-hidden="true" />

        <ol className="space-y-6">
          {milestones.map((milestone, index) => {
            const config = getStatusConfig(milestone.status);
            const isApproved = milestone.status === 'approved';
            const isLast = index === milestones.length - 1;

            return (
              <li key={milestone.phase} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-0 flex h-8 w-8 items-center justify-center">
                  {isApproved ? (
                    <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      milestone.status === 'reached' || milestone.status === 'evidence_submitted'
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30'
                        : 'border-border bg-background'
                    }`}>
                      <span className={`text-xs font-bold ${
                        milestone.status === 'reached' || milestone.status === 'evidence_submitted'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-muted-foreground'
                      }`}>
                        {milestone.phase}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={isLast ? '' : 'pb-2'}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {milestone.title}
                    </h3>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}>
                      {isApproved ? (
                        <CheckCircleIcon className="h-3 w-3" />
                      ) : milestone.status === 'reached' || milestone.status === 'evidence_submitted' ? (
                        <ClockIcon className="h-3 w-3" />
                      ) : null}
                      {config.label}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {milestone.description}
                  </p>

                  <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                    {milestone.fundAmountFormatted} ({milestone.fundPercentage}% of goal)
                    {isApproved && (
                      <span className="ml-1 text-green-600 dark:text-green-400">
                        - released
                      </span>
                    )}
                  </p>

                  {/* Approved evidence files */}
                  {milestone.evidence && milestone.evidence.length > 0 && (
                    <div className="mt-3 rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-800/40 dark:bg-green-950/20">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                        Verified Evidence ({milestone.evidence.length} {milestone.evidence.length === 1 ? 'file' : 'files'})
                      </p>
                      <div className="mt-2 space-y-2">
                        {milestone.evidence.map((file, fileIdx) => {
                          const isImage = file.mimeType.startsWith('image/');
                          return isImage ? (
                            <a
                              key={fileIdx}
                              href={file.fileUrl}
                              className="block overflow-hidden rounded-md border border-green-200 dark:border-green-800/40"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={file.fileUrl}
                                alt={file.fileName}
                                loading="lazy"
                                className="h-auto max-h-48 w-full object-cover"
                              />
                              <span className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1.5 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-400">
                                <PhotoIcon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{file.fileName}</span>
                              </span>
                            </a>
                          ) : (
                            <a
                              key={fileIdx}
                              href={file.fileUrl}
                              className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-700 transition-colors hover:bg-green-100 dark:border-green-800/40 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                            >
                              <DocumentIcon className="h-5 w-5 shrink-0" />
                              <span className="truncate">{file.fileName}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
