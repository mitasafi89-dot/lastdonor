'use client';

import { useState, useCallback } from 'react';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import type { CampaignCategory } from '@/types';

interface CampaignData {
  id: string;
  slug: string;
  title: string;
  heroImageUrl: string;
  subjectName: string;
  subjectHometown: string | null;
  campaignOrganizer: unknown;
  category: CampaignCategory;
  raisedAmount: number;
  goalAmount: number;
  donorCount: number;
  location: string | null;
}

interface CampaignGridProps {
  initialCampaigns: CampaignData[];
  initialCursor: string | null;
  initialHasMore: boolean;
  categoryFilter: CampaignCategory | null;
  sort: string;
  searchQuery: string;
  locationFilter: string;
  closeToTarget: boolean;
}

export function CampaignGrid({
  initialCampaigns,
  initialCursor,
  initialHasMore,
  categoryFilter,
  sort,
  searchQuery,
  locationFilter,
  closeToTarget,
}: CampaignGridProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ cursor, sort });
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery) params.set('q', searchQuery);
      if (locationFilter) params.set('location', locationFilter);
      if (closeToTarget) params.set('close_to_target', '1');

      const res = await fetch(`/api/v1/campaigns?${params.toString()}`);
      const json = await res.json();

      if (json.ok) {
        setCampaigns((prev) => [...prev, ...json.data]);
        setCursor(json.meta?.cursor ?? null);
        setHasMore(json.meta?.hasMore ?? false);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsLoading(false);
    }
  }, [cursor, isLoading, sort, categoryFilter, searchQuery, locationFilter, closeToTarget]);

  if (campaigns.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="text-lg text-muted-foreground">
          {categoryFilter
            ? 'No active campaigns in this category right now.'
            : 'No active campaigns at the moment. Check back soon.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            slug={campaign.slug}
            title={campaign.title}
            heroImageUrl={campaign.heroImageUrl}
            subjectName={campaign.subjectName}
            category={campaign.category}
            location={campaign.location || campaign.subjectHometown}
            raisedAmount={campaign.raisedAmount}
            goalAmount={campaign.goalAmount}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading…
              </span>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </>
  );
}
