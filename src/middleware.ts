import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export default auth(function middleware(request) {
  // Rate limiting for API routes
  const rateLimitResponse = checkRateLimit(request as unknown as NextRequest);
  if (rateLimitResponse) return rateLimitResponse;

  // Auth check — auth() wraps and populates request.auth
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
    '/dashboard/:path*',
    '/notifications/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api/v1/users/:path*',
    '/api/v1/admin/:path*',
    '/api/v1/donations/create-intent',
    '/api/v1/newsletter/:path*',
    '/api/v1/user-campaigns/:path*',
  ],
};
