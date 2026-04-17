import { auth } from '@/lib/auth';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Default-deny: ALL matched routes require auth unless explicitly listed
 * in PUBLIC_API_PREFIXES. This inverts the previous opt-in model so new
 * routes are protected by default.
 */
const PUBLIC_API_PREFIXES = [
  '/api/auth',
  '/api/v1/campaigns',
  '/api/v1/blog',
  '/api/v1/newsletter',
  '/api/v1/auth',
  '/api/v1/donations/webhook',
  '/api/v1/donations/confirm',
  '/api/v1/donations/create-checkout',
  '/api/v1/stripe-connect/webhook',
  '/api/v1/health',
  '/api/v1/stats',
  '/api/v1/search',
  '/api/v1/cron',
  '/api/v1/og',
  '/api/v1/campaign-photos',
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default auth(async function middleware(request) {
  // Rate limiting for API routes (distributed via Upstash, in-memory fallback)
  const rateLimitResponse = await checkRateLimitAsync(request as unknown as NextRequest);
  if (rateLimitResponse) return rateLimitResponse;

  // Public API routes: skip auth (they handle their own auth if needed)
  if (request.nextUrl.pathname.startsWith('/api/') && isPublicApiRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Auth check - auth() wraps and populates request.auth
  const session = request.auth;
  if (!session) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(request.nextUrl.pathname)}`, request.url),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Protected page routes
    '/dashboard/:path*',
    '/notifications/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/admin/:path*',
    // Default-deny: ALL API routes go through middleware
    '/api/:path*',
  ],
};
