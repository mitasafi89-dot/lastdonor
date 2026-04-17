import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-1 h-5 w-64" />
      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-24" />
          <div className="mt-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
