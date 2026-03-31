import { Skeleton } from '@/components/ui/skeleton';

export default function BlogPostLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumbs */}
      <Skeleton className="h-4 w-48" />

      {/* Cover image */}
      <Skeleton className="mt-6 aspect-[1200/630] w-full rounded-xl" />

      {/* Meta */}
      <div className="mt-6 flex items-center gap-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Title */}
      <Skeleton className="mt-4 h-10 w-3/4" />

      {/* Article body */}
      <div className="mt-8 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Share buttons */}
      <div className="mt-8 flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-9 rounded-lg" />
        ))}
      </div>

      {/* Author bio */}
      <div className="mt-8 flex items-start gap-4 rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
