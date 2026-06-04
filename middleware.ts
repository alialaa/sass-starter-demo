import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';
import { ratelimit } from '@/lib/ratelimit';

const protectedRoutes = '/dashboard';

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // API rate-limiting branch
  if (pathname.startsWith('/api')) {
    const sessionCookie = request.cookies.get('session');
    let identifier = 'anonymous';

    if (sessionCookie) {
      try {
        const parsed = await verifyToken(sessionCookie.value);
        identifier = String(parsed.user.id);
      } catch {
        // fall through to IP-based identifier
      }
    }

    if (identifier === 'anonymous') {
      identifier =
        request.headers.get('x-forwarded-for') ?? 'anonymous';
    }

    const { success, limit, remaining, reset, pending } =
      await ratelimit.limit(identifier);

    event.waitUntil(pending);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      });
    }

    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);

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
