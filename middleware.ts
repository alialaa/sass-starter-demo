import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { NextFetchEvent } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';
import {
  globalLimiter,
  authLimiter,
  defaultLimiter,
  webhookLimiter,
  getIp,
} from '@/lib/ratelimit';

const protectedRoutes = '/dashboard';

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);

  if (pathname.startsWith('/api/')) {
    const ip = getIp(request);

    const routeLimiter =
      pathname.startsWith('/api/auth/')
        ? authLimiter
        : pathname === '/api/stripe/webhook'
        ? webhookLimiter
        : defaultLimiter;

    const [globalResult, routeResult] = await Promise.all([
      globalLimiter.limit('global'),
      routeLimiter.limit(ip),
    ]);

    event.waitUntil(Promise.all([globalResult.pending, routeResult.pending]));

    if (!globalResult.success || !routeResult.success) {
      const failing = !globalResult.success ? globalResult : routeResult;
      return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((failing.reset - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(failing.limit),
          'X-RateLimit-Remaining': String(failing.remaining),
          'X-RateLimit-Reset': String(failing.reset),
        },
      });
    }

    return NextResponse.next();
  }

  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  let res = NextResponse.next();

  if (sessionCookie && request.method === 'GET') {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

      res.cookies.set({
        name: 'session',
        value: await signToken({
          ...parsed,
          expires: expiresInOneDay.toISOString()
        }),
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        expires: expiresInOneDay
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.cookies.delete('session');
      if (isProtectedRoute) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/api/:path*',
  ],
  runtime: 'nodejs'
};
