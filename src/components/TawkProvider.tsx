'use client';

/**
 * TawkProvider
 *
 * Loads the Tawk.to live chat widget and manages two concerns:
 *
 *   1. Visitor identification
 *      When a user is signed in, their name, email, and role are passed to the
 *      Tawk API so the support agent immediately sees who they are talking to
 *      without asking. This eliminates a frustrating back-and-forth and allows
 *      the agent to pull up the user's account in parallel with reading the
 *      first message — a material improvement to response quality and speed.
 *
 *   2. Route-based visibility
 *      The widget is hidden on /admin/* because admin staff operate through the
 *      Tawk.to agent dashboard (not the embedded widget), and showing a chat
 *      bubble on their own admin console creates visual noise with no benefit.
 *      Every other route keeps the widget visible: donors on campaign pages,
 *      campaigners completing verification, and anonymous visitors on the
 *      homepage all have legitimate reasons to need support.
 *
 * Script loading strategy
 * -----------------------
 * We initialize window.Tawk_API as an empty object and register onLoad on it
 * BEFORE inserting the <script> tag. Tawk's library, on evaluation, merges the
 * existing window.Tawk_API rather than replacing it. This guarantees our
 * onLoad handler is present when the library first runs — eliminating the race
 * condition where the library fires onLoad before our React effect has had a
 * chance to attach the listener.
 *
 * Race condition matrix (two independent async processes: Tawk load + session)
 * ---------------------------------------------------------------------------
 *   Ordering A — Tawk loads first, session arrives later:
 *     onLoad → applyVisitorAttributes(null) = no-op (no email, skips cleanly)
 *     session useEffect fires → setAttributes is now defined → sets attributes
 *
 *   Ordering B — Session arrives first, Tawk loads later:
 *     session useEffect fires → Tawk_API.setAttributes is undefined → no-op
 *     onLoad fires → reads sessionRef.current (already populated) → sets attrs
 *
 *   Both orderings result in attributes being applied exactly once on ready.
 *
 * No external package dependencies. The integration follows Tawk's official
 * CDN script injection pattern verbatim to maximize compatibility.
 */

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import type { UserRole } from '@/types';

const PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
const WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID ?? 'default';

/** Unique DOM id for the injected Tawk script element — used as idempotency key. */
const SCRIPT_ELEMENT_ID = 'tawk-to-script';

/**
 * Returns true for routes where the chat widget should not be shown.
 *
 * /admin/* — Admin staff use the Tawk.to agent dashboard. The embedded widget
 * on their own admin pages is irrelevant and visually distracting.
 */
function isHiddenRoute(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

/**
 * Apply widget visibility based on the current route.
 * Silent no-op when Tawk API is not yet loaded.
 */
function applyVisibility(pathname: string): void {
  if (!window.Tawk_API) return;
  if (isHiddenRoute(pathname)) {
    window.Tawk_API.hideWidget?.();
  } else {
    window.Tawk_API.showWidget?.();
  }
}

/**
 * Pass visitor identity to the Tawk agent dashboard.
 *
 * Attributes surfaced to the agent:
 *   name  — Conversation header in the agent inbox (reduces "who are you?")
 *   email — Used by Tawk for visitor history matching across sessions
 *   role  — donor | editor | admin — lets the agent triage the request type
 *           without asking (e.g., a "donor" asking about their receipt vs.
 *           a "donor" asking how to start a campaign = likely a campaigner)
 *
 * Silent no-op when:
 *   - Tawk API is not yet loaded (setAttributes undefined)
 *   - Session is absent or has no email (unauthenticated visitor)
 *     Unauthenticated visitors are still served by Tawk normally; we simply
 *     do not pre-fill their identity since we do not know it.
 */
function applyVisitorAttributes(session: Session | null): void {
  if (!window.Tawk_API?.setAttributes) return;
  if (!session?.user?.email) return;

  window.Tawk_API.setAttributes(
    {
      name: session.user.name ?? 'Anonymous Visitor',
      email: session.user.email,
      // session.user.role is typed as UserRole via the next-auth.d.ts augmentation.
      role: (session.user.role as UserRole | undefined) ?? 'donor',
    },
    (error?: Error) => {
      // Only log in development; swallow silently in production to avoid
      // flooding Sentry with non-actionable Tawk API failures.
      if (error && process.env.NODE_ENV === 'development') {
        console.error('[Tawk] setAttributes failed:', error);
      }
    },
  );
}

export function TawkProvider() {
  const { data: session } = useSession();
  const pathname = usePathname();

  /**
   * Refs give the onLoad callback stable access to the latest session and
   * pathname without capturing stale closure values. They are updated on every
   * render before any effects run, so onLoad always reads current state.
   */
  const sessionRef = useRef<Session | null>(session);
  const pathnameRef = useRef(pathname);
  sessionRef.current = session;
  pathnameRef.current = pathname;

  // ── Script injection ──────────────────────────────────────────────────────
  useEffect(() => {
    // Guard: do not attempt to load if the property ID is not configured.
    // This prevents a silent 404 request to embed.tawk.to/undefined/default
    // in local dev or CI environments where the variable is absent.
    if (!PROPERTY_ID) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[Tawk] NEXT_PUBLIC_TAWK_PROPERTY_ID is not set. ' +
            'Live chat widget will not load. ' +
            'Add this variable to .env.local to enable Tawk.to.',
        );
      }
      return;
    }

    // Idempotency guard: prevents duplicate script injection on React Strict
    // Mode double-invocation (dev only) and on HMR component remounts.
    // The script element persists in the DOM across React re-renders.
    if (document.getElementById(SCRIPT_ELEMENT_ID)) return;

    // Initialize the API object and register onLoad BEFORE the script tag is
    // inserted. Tawk merges window.Tawk_API on first evaluation, so anything
    // set here (including onLoad) is preserved and not overwritten.
    window.Tawk_API = window.Tawk_API ?? {};
    window.Tawk_LoadStart = new Date();

    window.Tawk_API.onLoad = function () {
      // Widget fully initialized. Apply initial state from current route and
      // session. sessionRef/pathnameRef hold the latest values even if the
      // component re-rendered between script insertion and this callback.
      applyVisibility(pathnameRef.current);
      applyVisitorAttributes(sessionRef.current);
    };

    const script = document.createElement('script');
    script.id = SCRIPT_ELEMENT_ID;
    script.async = true;
    script.src = `https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');

    // Tawk's official injection pattern: insert before the first script on the
    // page. This mirrors what their dashboard-generated snippet produces and
    // ensures maximum compatibility with their internal bootstrapping logic.
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(script, firstScript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Intentionally empty deps: script injection must run exactly once on mount.
  // sessionRef and pathnameRef are refs (not reactive state), so they do not
  // need to be listed — they are always current when read inside the callback.

  // ── Visitor identification (reacts to auth state changes) ─────────────────
  // Handles Ordering A: Tawk was already loaded when the session arrived.
  // Also handles sign-out: session becomes null, but setAttributes with null
  // email is a no-op, so no stale identity is written to a new visitor session.
  useEffect(() => {
    applyVisitorAttributes(session);
  }, [session]);

  // ── Route-based visibility (reacts to client-side navigation) ─────────────
  // Handles show/hide on every route transition after the widget has loaded.
  // If Tawk is not yet loaded when this fires, applyVisibility is a no-op —
  // the correct initial visibility is applied by onLoad instead.
  useEffect(() => {
    applyVisibility(pathname);
  }, [pathname]);

  // This component has no DOM output. Its only side-effect is script injection
  // and Tawk API calls.
  return null;
}
