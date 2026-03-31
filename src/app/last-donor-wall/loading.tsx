import { Skeleton } from '@/components/ui/skeleton';

export default function LastDonorWallLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-6 h-10 w-56" />
      <Skeleton className="mt-3 h-5 w-96" />

      <div className="mt-10 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="mt-1 h-4 w-40" />
            </div>
            <div className="text-right">
              <Skeleton className="ml-auto h-6 w-28" />
              <Skeleton className="ml-auto mt-1 h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
