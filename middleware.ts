import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';
import { jwtVerify } from 'jose';
import { ratelimit } from '@/lib/ratelimit';

const protectedRoutes = '/dashboard';

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);

  // Rate limiting for all /api/* routes except the Stripe webhook
  if (pathname.startsWith('/api/') && pathname !== '/api/stripe/webhook') {
    let identifier: string;

    try {
      const token = sessionCookie?.value;
      if (token) {
        const key = new TextEncoder().encode(process.env.AUTH_SECRET);
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        const sessionPayload = payload as { user: { id: number }; expires: string };
        identifier = `user_${sessionPayload.user.id}`;
      } else {
        throw new Error('No session cookie');
      }
    } catch {
      identifier =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        request.ip ??
        'anonymous';
    }

    const { success, pending, limit, remaining, reset } = await ratelimit.limit(identifier);
    event.waitUntil(pending);

    if (!success) {
      const now = Math.floor(Date.now() / 1000);
      const retryAfter = Math.max(0, reset - now);
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
        },
      });
    }
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)', '/api/:path*'],
  runtime: 'nodejs'
};
