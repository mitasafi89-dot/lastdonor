import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignDetailLoading() {
  return (
    <article className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumbs */}
      <Skeleton className="h-4 w-48" />

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Hero image */}
          <Skeleton className="aspect-[3/2] max-h-[420px] w-full rounded-lg" />

          {/* Title + meta */}
          <div>
            <Skeleton className="h-8 w-3/4" />
            <div className="mt-3 flex items-center gap-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>

          {/* Progress card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="mt-3 flex items-center justify-between">
              <Skeleton className="h-8 w-40" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          </div>

          {/* Story content */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Donation form card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-12 w-full rounded-lg" />
            <Skeleton className="mt-3 h-12 w-full rounded-lg" />
          </div>

          {/* Donor feed */}
          <div className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-1 h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
