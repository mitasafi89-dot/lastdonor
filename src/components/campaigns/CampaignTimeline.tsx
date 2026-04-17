'use client';

import { formatDistanceToNow, format } from 'date-fns';

interface TimelineEvent {
  id: string;
  type: 'created' | 'published' | 'paused' | 'resumed' | 'suspended' | 'cancelled' | 'completed' | 'info_request' | 'fund_released' | 'verified';
  title: string;
  description?: string;
  timestamp: string | Date;
}

const EVENT_ICONS: Record<TimelineEvent['type'], { icon: string; color: string }> = {
  created: { icon: '📝', color: 'bg-gray-200' },
  published: { icon: '🚀', color: 'bg-emerald-200' },
  paused: { icon: '⏸️', color: 'bg-yellow-200' },
  resumed: { icon: '▶️', color: 'bg-emerald-200' },
  suspended: { icon: '🚫', color: 'bg-red-200' },
  cancelled: { icon: '❌', color: 'bg-red-300' },
  completed: { icon: '🎉', color: 'bg-teal-200' },
  info_request: { icon: '📋', color: 'bg-blue-200' },
  fund_released: { icon: '💰', color: 'bg-green-200' },
  verified: { icon: '✅', color: 'bg-teal-200' },
};

export function CampaignTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gray-200 dark:bg-gray-700" />

      {events.map((event, _idx) => {
        const config = EVENT_ICONS[event.type] ?? EVENT_ICONS.created;
        const ts = typeof event.timestamp === 'string' ? new Date(event.timestamp) : event.timestamp;

        return (
          <div key={event.id} className="relative flex items-start gap-4 py-3">
            {/* Icon circle */}
            <div
              className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${config.color}`}
              aria-hidden="true"
            >
              {config.icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {event.title}
              </p>
              {event.description && (
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  {event.description}
                </p>
              )}
              <time
                className="mt-1 block text-xs text-gray-500 dark:text-gray-500"
                dateTime={ts.toISOString()}
                title={format(ts, 'PPPpp')}
              >
                {formatDistanceToNow(ts, { addSuffix: true })}
              </time>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { TimelineEvent };
