'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A thin progress bar at the top of the viewport that animates during
 * Next.js route transitions. Inspired by YouTube/GitHub loading bars.
 *
 * Uses pathname + searchParams changes to detect navigation start/end.
 * No external dependencies - pure CSS animation.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'completing'>('idle');
  const prevUrlRef = useRef('');

  const currentUrl = `${pathname}?${searchParams.toString()}`;

  // When the URL actually changes, the new page has loaded - complete the bar
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== currentUrl) {
      setState('completing');
      const timeout = setTimeout(() => setState('idle'), 300);
      return () => clearTimeout(timeout);
    }
    prevUrlRef.current = currentUrl;
  }, [currentUrl]);

  // Intercept click events on links to detect navigation start
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (
        !anchor ||
        !anchor.href ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      ) {
        return;
      }

      try {
        const url = new URL(anchor.href);
        // Only trigger for same-origin navigations
        if (url.origin !== window.location.origin) return;
        // Skip same-page links (no actual navigation)
        const search = searchParams.toString();
        if (url.pathname === pathname && url.search === (search ? `?${search}` : '')) return;

        setState('loading');
      } catch {
        // Invalid URL - ignore
      }
    },
    [pathname, searchParams],
  );

  useEffect(() => {
    document.addEventListener('click', handleClick, { capture: true });
    return () =>
      document.removeEventListener('click', handleClick, { capture: true });
  }, [handleClick]);

  if (state === 'idle') return null;

  return (
    <div
      role="progressbar"
      aria-label="Page loading"
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed inset-x-0 top-0 z-[9999] h-[3px]"
    >
      <div
        className={
          state === 'loading'
            ? 'h-full bg-primary shadow-[0_0_8px_theme(colors.primary)] animate-progress-bar'
            : 'h-full w-full bg-primary shadow-[0_0_8px_theme(colors.primary)] transition-opacity duration-300 opacity-0'
        }
      />
    </div>
  );
}
