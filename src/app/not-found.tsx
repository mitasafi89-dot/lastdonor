import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found — LastDonor.org',
};

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-6xl font-bold text-brand-teal">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
        Page Not Found
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        This page does not exist or has been moved. But there are plenty of
        people who could use your help right now.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Go Home
        </Link>
        <Link
          href="/campaigns"
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          Browse Campaigns
        </Link>
      </div>
    </main>
  );
}
