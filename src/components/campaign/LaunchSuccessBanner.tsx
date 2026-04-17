'use client';

import { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ShareButtons } from '@/components/campaign/ShareButtons';

interface LaunchSuccessBannerProps {
  campaignSlug: string;
  campaignTitle: string;
  canonicalUrl: string;
  verificationStatus: string;
}

export function LaunchSuccessBanner({
  campaignSlug,
  campaignTitle,
  canonicalUrl,
  verificationStatus,
}: LaunchSuccessBannerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (!searchParams.get('launched') || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    // Clean the URL so refreshing doesn't re-show the banner
    router.replace(pathname, { scroll: false });
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">
            Your campaign is live
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to donate and show supporters you believe in this
            cause. Even a small amount builds momentum before you share.
          </p>
          <Link
            href={`/campaigns/${campaignSlug}/donate`}
            className="mt-2 inline-block text-sm font-semibold text-foreground underline hover:text-primary"
          >
            Make the first donation
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Then share it. The first 24 hours are when campaigns get the
          most traction.
        </p>
        <div className="mt-2">
          <ShareButtons url={canonicalUrl} title={campaignTitle} />
        </div>
      </div>

      {verificationStatus === 'unverified' && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Verify your campaign to earn a trust badge and increase donor confidence.
          </p>
          <Link
            href={`/dashboard/campaigns/${campaignSlug}/verification`}
            className="mt-2 inline-block text-sm font-semibold text-foreground underline hover:text-primary"
          >
            Start verification
          </Link>
        </div>
      )}
    </div>
  );
}
