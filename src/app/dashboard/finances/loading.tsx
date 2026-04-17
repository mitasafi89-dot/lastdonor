import { Skeleton } from '@/components/ui/skeleton';

export default function FinancesLoading() {
  return (
    <div>
      <Skeleton className="h-5 w-48" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
