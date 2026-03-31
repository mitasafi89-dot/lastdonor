import { NextRequest, NextResponse } from 'next/server';
import type { ApiError } from '@/types/api';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store. In production, use Redis or a distributed store.
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

interface RateLimitConfig {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/v1/donations/create-intent': { maxRequests: 10, windowMs: 60_000 },
  '/api/v1/auth': { maxRequests: 10, windowMs: 60_000 },
  '/api/v1/newsletter': { maxRequests: 5, windowMs: 60_000 },
  '/api/v1/users': { maxRequests: 30, windowMs: 60_000 },
  '/api/v1/blog': { maxRequests: 60, windowMs: 60_000 },
  '/api/v1/campaigns': { maxRequests: 60, windowMs: 60_000 },
  '/api/v1/admin': { maxRequests: 60, windowMs: 60_000 },
};

function getConfig(pathname: string): RateLimitConfig {
  // Find the most specific matching route
  for (const [route, config] of Object.entries(ROUTE_LIMITS)) {
    if (pathname.startsWith(route)) {
      return config;
    }
  }
  // Default: generous limit for unmatched routes
  return { maxRequests: 100, windowMs: 60_000 };
}

/**
 * Returns null if the request is allowed, or a NextResponse if rate limited.
 */
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) return null;

  // Skip webhook routes (Stripe needs reliable delivery)
  if (pathname.includes('/webhook')) return null;

  cleanup();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const config = getConfig(pathname);
  const key = `${ip}:${pathname.split('/').slice(0, 5).join('/')}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const requestId = crypto.randomUUID();
    const body: ApiError = {
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        requestId,
      },
    };

    return NextResponse.json(body, {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
      },
    });
  }

  return null;
}
