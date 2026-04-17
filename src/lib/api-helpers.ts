/**
 * Shared API Route Helpers
 *
 * DRY utilities for common patterns repeated across API routes:
 * - Pagination parameter parsing
 * - Zod validation with standardized error responses
 * - Auth requirement enforcement
 * - Anonymous donor mapping
 *
 * These complement withApiHandler() (which handles error wrapping)
 * by extracting the repeated patterns within route handler bodies.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import type { ZodSchema } from 'zod';
import { apiError } from '@/lib/errors';
import type { ApiResponse } from '@/types/api';
import type { CampaignCategory } from '@/types';
import { CAMPAIGN_CATEGORIES } from '@/lib/categories';

// ─── Pagination ─────────────────────────────────────────────────────────────

interface PaginationParams {
  limit: number;
  offset: number;
  cursor: string | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Parse limit + offset pagination params from a request URL.
 * Returns null offset when no cursor is provided.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  opts?: { defaultLimit?: number; maxLimit?: number },
): PaginationParams {
  const maxLimit = opts?.maxLimit ?? MAX_LIMIT;
  const defaultLimit = opts?.defaultLimit ?? DEFAULT_LIMIT;

  const rawLimit = parseInt(searchParams.get('limit') ?? String(defaultLimit), 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? defaultLimit : rawLimit), maxLimit);

  const cursorParam = searchParams.get('cursor');
  const rawOffset = cursorParam ? parseInt(cursorParam, 10) : 0;
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  return { limit, offset, cursor: cursorParam };
}

/**
 * Build a paginated API response from a query result.
 * Expects the query to fetch `limit + 1` rows (the overfetch pattern).
 */
export function paginatedResponse<T>(
  rows: T[],
  limit: number,
  offset: number,
): NextResponse<ApiResponse<T[]>> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(offset + limit) : undefined;

  return NextResponse.json({
    ok: true as const,
    data,
    meta: { cursor: nextCursor, hasMore },
  });
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Parse and validate a request body with a Zod schema.
 * Returns the parsed data on success, or a NextResponse error on failure.
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  requestId: string,
): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      error: apiError('VALIDATION_ERROR', 'Invalid JSON in request body.', requestId),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.errors[0];
    return {
      error: apiError('VALIDATION_ERROR', firstIssue.message, requestId, {
        field: firstIssue.path.join('.'),
      }),
    };
  }

  return { data: parsed.data };
}

// ─── Auth Helpers ───────────────────────────────────────────────────────────

/**
 * Require an authenticated session. Returns the session or an error response.
 */
export function requireAuth(
  session: Session | null,
  requestId: string,
): { session: Session & { user: { id: string } } } | { error: NextResponse } {
  if (!session?.user?.id) {
    return { error: apiError('UNAUTHORIZED', 'Authentication required.', requestId) };
  }
  return { session: session as Session & { user: { id: string } } };
}

/**
 * Require an authenticated session with a specific role.
 */
export function requireAuthRole(
  session: Session | null,
  roles: string[],
  requestId: string,
): { session: Session & { user: { id: string; role: string } } } | { error: NextResponse } {
  const authResult = requireAuth(session, requestId);
  if ('error' in authResult) return authResult;

  const userRole = (authResult.session.user as { id: string; role?: string }).role;
  if (!userRole || !roles.includes(userRole)) {
    return { error: apiError('FORBIDDEN', 'Insufficient permissions.', requestId) };
  }

  return { session: authResult.session as Session & { user: { id: string; role: string } } };
}

// ─── Domain Helpers ─────────────────────────────────────────────────────────

/** Set of valid campaign category values, derived from the single source of truth. */
export const VALID_CATEGORY_SET = new Set<string>(
  CAMPAIGN_CATEGORIES.map((c) => c.value),
);

/**
 * Check if a string is a valid campaign category.
 */
export function isValidCategory(value: string | null | undefined): value is CampaignCategory {
  return value != null && VALID_CATEGORY_SET.has(value);
}

/**
 * Redact anonymous donor information.
 * Use this instead of duplicating the mapping in every donor/message endpoint.
 */
export function redactAnonymousDonor<T extends { isAnonymous: boolean; donorName: string | null; donorLocation?: string | null }>(
  donor: T,
): T {
  if (!donor.isAnonymous) return donor;
  return {
    ...donor,
    donorName: 'Anonymous',
    donorLocation: null,
  };
}

// ─── Sort Order Helper ──────────────────────────────────────────────────────

/**
 * Resolve a sort key from a map of allowed values.
 * Falls back to the default if the key is missing or invalid.
 * Eliminates repeated switch/IIFE patterns in route handlers.
 */
export function resolveSortOrder<T>(
  sortParam: string | null,
  sortMap: Record<string, T>,
  defaultKey: string,
): T {
  if (sortParam && sortParam in sortMap) {
    return sortMap[sortParam];
  }
  return sortMap[defaultKey];
}
