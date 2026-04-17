import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { ApiError } from '@/types/api';

// ─── In-memory fallback store (per-instance backstop for dev / Upstash outage) ──

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 50_000;
const CLEANUP_INTERVAL = 60_000;
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
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const entries = [...rateLimitStore.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDelete = entries.slice(0, rateLimitStore.size - MAX_STORE_SIZE);
    for (const [key] of toDelete) rateLimitStore.delete(key);
  }
}

// ─── Distributed (Upstash Redis) rate limiters – one per route tier ─────────

type UpstashLimiter = InstanceType<typeof Ratelimit>;
let distributedLimiters: Record<string, UpstashLimiter> | null = null;
let distributedInitAttempted = false;

function initDistributedLimiters(): Record<string, UpstashLimiter> | null {
  if (distributedInitAttempted) return distributedLimiters;
  distributedInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[RATE-LIMIT] WARNING: UPSTASH_REDIS_REST_URL/TOKEN not set. ' +
        'In-memory-only rate limiting is insufficient for production serverless.',
      );
    }
    return null;
  }

  try {
    const redis = new Redis({ url, token });

    distributedLimiters = {
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        analytics: false,
        prefix: 'rl:lastdonor:auth',
      }),
      newsletter: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'),
        analytics: false,
        prefix: 'rl:lastdonor:newsletter',
      }),
      donations: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        analytics: false,
        prefix: 'rl:lastdonor:donations',
      }),
      users: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        analytics: false,
        prefix: 'rl:lastdonor:users',
      }),
      default: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '60 s'),
        analytics: false,
        prefix: 'rl:lastdonor:default',
      }),
    };
  } catch (err) {
    console.error('[RATE-LIMIT] Failed to initialise Upstash limiters:', err);
    distributedLimiters = null;
  }
  return distributedLimiters;
}

/** Map a pathname to its distributed limiter tier key. */
function getLimiterTier(pathname: string): string {
  if (pathname.startsWith('/api/v1/auth') || pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api/v1/newsletter')) return 'newsletter';
  if (pathname.startsWith('/api/v1/donations')) return 'donations';
  if (pathname.startsWith('/api/v1/users')) return 'users';
  return 'default';
}

// ─── Per-route in-memory config (used as fallback) ──────────────────────────

interface RateLimitConfig {
  maxRequests: number;
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
  for (const [route, config] of Object.entries(ROUTE_LIMITS)) {
    if (pathname.startsWith(route)) return config;
  }
  return { maxRequests: 100, windowMs: 60_000 };
}

// ─── In-memory check (synchronous) ─────────────────────────────────────────

function checkInMemory(key: string, config: RateLimitConfig): NextResponse | null {
  cleanup();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    return build429(config.maxRequests, entry.resetAt);
  }

  return null;
}

function build429(limit: number, resetAt: number): NextResponse {
  const now = Date.now();
  const retryAfter = Math.ceil((resetAt - now) / 1000);
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
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    },
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Async rate-limit check. Uses Upstash as the **primary synchronous**
 * enforcement across all serverless instances. Falls back to in-memory
 * only when Upstash is unavailable (dev mode or outage).
 */
export async function checkRateLimitAsync(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.includes('/webhook')) return null;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const config = getConfig(pathname);
  const key = `${ip}:${pathname.split('/').slice(0, 5).join('/')}`;

  // ── Try distributed (Upstash) limiter first ──────────────────────────────
  const limiters = initDistributedLimiters();
  if (limiters) {
    const tier = getLimiterTier(pathname);
    const limiter = limiters[tier] ?? limiters.default;
    try {
      const result = await limiter.limit(key);
      if (!result.success) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please try again later.',
              requestId: crypto.randomUUID(),
            },
          } satisfies ApiError,
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(Math.max(result.reset - Date.now(), 1000) / 1000)),
              'X-RateLimit-Remaining': String(result.remaining),
            },
          },
        );
      }
      // Distributed check passed - skip in-memory
      return null;
    } catch (err) {
      // Upstash request failed - fall through to in-memory backstop
      console.warn('[RATE-LIMIT] Upstash error, falling back to in-memory:', err);
    }
  }

  // ── In-memory fallback (per-instance, dev, or Upstash outage) ─────────────
  return checkInMemory(key, config);
}

/**
 * Synchronous in-memory-only rate-limit check (legacy).
 * Kept for backwards compatibility; callers should migrate to checkRateLimitAsync.
 */
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.includes('/webhook')) return null;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const config = getConfig(pathname);
  const key = `${ip}:${pathname.split('/').slice(0, 5).join('/')}`;

  return checkInMemory(key, config);
}
