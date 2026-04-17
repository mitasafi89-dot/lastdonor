/**
 * Safe API Route Handler Wrapper
 *
 * Wraps Next.js API route handlers with automatic error handling, request ID
 * generation, structured logging, and response sanitization.
 *
 * Usage:
 *   export const GET = withApiHandler(async (req, { requestId, session }) => {
 *     return NextResponse.json({ ok: true, data: { ... } });
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { handleApiError, logError } from '@/lib/errors';
import type { Session } from 'next-auth';

interface HandlerContext {
  requestId: string;
  /** The authenticated session, if available. Null for public routes. */
  session: Session | null;
  /** Client IP address (best effort from headers). */
  ip: string;
  /** The params from dynamic routes (already awaited). */
  params?: Record<string, string>;
}

type RouteHandler = (
  request: NextRequest,
  context: HandlerContext,
) => Promise<NextResponse>;

interface WithApiHandlerOptions {
  /** If true, does not attempt to read the session (for public/webhook routes). */
  skipAuth?: boolean;
}

/**
 * Wraps an API route handler with centralized error handling.
 *
 * - Generates a unique requestId for every request
 * - Catches ALL errors and returns a safe response
 * - Logs the full error internally with context
 * - Never exposes stack traces or internal messages to the client
 */
export function withApiHandler(
  handler: RouteHandler,
  options?: WithApiHandlerOptions,
) {
  return async (
    request: NextRequest,
    routeContext: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = randomUUID();
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    let session: Session | null = null;

    try {
      // Resolve session if needed
      if (!options?.skipAuth) {
        try {
          session = await auth();
        } catch {
          // Auth resolution failure should not crash the route
        }
      }

      // Resolve dynamic route params
      const params = routeContext.params ? await routeContext.params : undefined;

      const response = await handler(request, {
        requestId,
        session,
        ip,
        params,
      });

      return response;
    } catch (error) {
      return handleApiError(error, requestId, {
        route: request.nextUrl.pathname,
        method: request.method,
        userId: session?.user?.id,
        ip,
      });
    }
  };
}

/**
 * Fire-and-forget wrapper for non-critical async operations
 * (e.g., sending notifications, emails). Logs failures without crashing.
 *
 * Tracks failure counts per label within a rolling window so that
 * persistent silent failures become observable via getSafeAsyncStats().
 */

// Rolling failure counter: label -> timestamps of recent failures
const _failureCounts = new Map<string, number[]>();
const _FAILURE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function safeAsync(
  promise: Promise<unknown>,
  label: string,
  context?: { requestId?: string; userId?: string },
): void {
  promise.catch((error) => {
    logError(error, {
      requestId: context?.requestId ?? 'background',
      route: label,
      userId: context?.userId,
    });

    // Track failure for observability
    const now = Date.now();
    const timestamps = _failureCounts.get(label) ?? [];
    timestamps.push(now);
    // Evict entries outside the rolling window
    const cutoff = now - _FAILURE_WINDOW_MS;
    const pruned = timestamps.filter((t) => t > cutoff);
    _failureCounts.set(label, pruned);

    if (pruned.length >= 10) {
      console.error(
        `[safeAsync] DEGRADATION ALERT: "${label}" has failed ${pruned.length} times in the last hour`,
      );
    }
  });
}

/**
 * Returns per-label failure counts within the rolling window.
 * Useful for admin health-check endpoints.
 */
export function getSafeAsyncStats(): Record<string, number> {
  const now = Date.now();
  const cutoff = now - _FAILURE_WINDOW_MS;
  const stats: Record<string, number> = {};
  for (const [label, timestamps] of _failureCounts) {
    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length > 0) {
      stats[label] = recent.length;
      _failureCounts.set(label, recent); // prune while reading
    } else {
      _failureCounts.delete(label);
    }
  }
  return stats;
}
