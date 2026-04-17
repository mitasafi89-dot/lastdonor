'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { PlayIcon } from '@heroicons/react/24/solid';
import { CampaignHeroImage } from '@/components/campaign/CampaignHeroImage';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MediaItem {
  type: 'image' | 'youtube';
  src: string;
  /** YouTube video ID (only for type=youtube) */
  videoId?: string;
}

interface MediaGalleryProps {
  heroImageUrl: string;
  galleryImages: string[];
  youtubeUrl: string | null;
  title: string;
  category: string;
  photoCredit?: string | null;
}

// ─── YouTube ID extraction ──────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(u.hostname)) {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const match = u.pathname.match(/^\/(embed|shorts)\/([\w-]{11})/);
      if (match) return match[2];
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MediaGallery({
  heroImageUrl,
  galleryImages,
  youtubeUrl,
  title,
  category,
  photoCredit,
}: MediaGalleryProps) {
  // Build ordered media items: hero image first, gallery images, then YouTube
  const items: MediaItem[] = [];
  items.push({ type: 'image', src: heroImageUrl });
  for (const url of galleryImages) {
    items.push({ type: 'image', src: url });
  }
  if (youtubeUrl) {
    const videoId = extractYouTubeId(youtubeUrl);
    if (videoId) {
      items.push({ type: 'youtube', src: youtubeUrl, videoId });
    }
  }

  const [current, setCurrent] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const totalItems = items.length;
  const hasMultiple = totalItems > 1;

  // Touch/swipe tracking
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset to first slide when items change (e.g., route change)
  useEffect(() => {
    setCurrent(0);
    setVideoPlaying(false);
  }, [heroImageUrl]);

  const goTo = useCallback(
    (index: number) => {
      setVideoPlaying(false);
      if (index < 0) setCurrent(totalItems - 1);
      else if (index >= totalItems) setCurrent(0);
      else setCurrent(index);
    },
    [totalItems],
  );

  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);
  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    if (!hasMultiple) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Only respond when the gallery or its children are focused
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== containerRef.current) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(current + 1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMultiple, current, goTo]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 50; // px
    if (touchDeltaX.current > threshold) goPrev();
    else if (touchDeltaX.current < -threshold) goNext();
    touchDeltaX.current = 0;
  }, [goPrev, goNext]);

  const currentItem = items[current];

  return (
    <div className="space-y-1">
      {/* Main media area */}
      <div
        ref={containerRef}
        className="group relative overflow-hidden rounded-lg bg-muted"
        tabIndex={hasMultiple ? 0 : undefined}
        role={hasMultiple ? 'region' : undefined}
        aria-label={hasMultiple ? `Campaign media gallery, showing item ${current + 1} of ${totalItems}` : undefined}
        aria-roledescription={hasMultiple ? 'carousel' : undefined}
        onTouchStart={hasMultiple ? handleTouchStart : undefined}
        onTouchMove={hasMultiple ? handleTouchMove : undefined}
        onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
      >
        <div className="relative aspect-[3/2] max-h-[420px]">
          {currentItem.type === 'image' ? (
            currentItem.src.startsWith('blob:') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentItem.src}
                alt={current === 0 ? title : `${title} - photo ${current + 1}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <CampaignHeroImage
                src={currentItem.src}
                alt={current === 0 ? title : `${title} - photo ${current + 1}`}
                category={category}
                fill
                priority={current === 0}
                sizes="(max-width: 1024px) 100vw, 660px"
                className="object-cover"
              />
            )
          ) : videoPlaying ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${currentItem.videoId}?rel=0&autoplay=1`}
              title={`${title} - video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setVideoPlaying(true)}
              className="group/play absolute inset-0 flex cursor-pointer items-center justify-center bg-black"
              aria-label="Play video"
            >
              {/* YouTube thumbnail */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.youtube.com/vi/${currentItem.videoId}/hqdefault.jpg`}
                alt="Video thumbnail"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover/play:opacity-75"
                loading="lazy"
              />
              {/* Play button */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-xl transition-transform group-hover/play:scale-110 sm:h-[68px] sm:w-[68px]">
                <PlayIcon className="ml-1 h-7 w-7 text-white sm:h-8 sm:w-8" />
              </div>
            </button>
          )}

          {/* Navigation arrows - visible on hover (desktop) or always on touch */}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-lg transition-opacity hover:bg-black/70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 sm:h-10 sm:w-10"
                aria-label="Previous"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-lg transition-opacity hover:bg-black/70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 sm:h-10 sm:w-10"
                aria-label="Next"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Status badges slot - rendered by parent via children if needed */}
        </div>

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current
                    ? 'w-5 bg-white shadow-md'
                    : 'w-2 bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`Go to ${item.type === 'youtube' ? 'video' : `photo ${i + 1}`}`}
                aria-current={i === current ? 'true' : undefined}
              />
            ))}
          </div>
        )}

        {/* Media count badge */}
        {hasMultiple && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {current + 1} / {totalItems}
          </div>
        )}
      </div>

      {/* Photo credit */}
      {photoCredit && currentItem.type === 'image' && (
        <p className="text-right text-xs text-muted-foreground">
          {photoCredit}
        </p>
      )}
    </div>
  );
}
