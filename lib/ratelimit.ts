import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Global limiter — shared budget across all IPs.
 * Uses a constant key 'global' so all requests count against one counter.
 */
export const globalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(500, '1 m'),
  prefix: 'rl:global',
});

/**
 * Auth limiter — strict limit for sign-in / sign-up paths.
 */
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, '1 m'),
  prefix: 'rl:auth',
});

/**
 * Default limiter — general API routes.
 */
export const defaultLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:default',
});

/**
 * Webhook limiter — relaxed limit for the Stripe webhook endpoint.
 */
export const webhookLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, '1 m'),
  prefix: 'rl:webhook',
});

/**
 * Extract the client IP from the request.
 * Prefers the `x-forwarded-for` header (set by trusted proxies / Vercel)
 * over any runtime-specific property, falling back to 'anon'.
 *
 * Note: `NextRequest` in the middleware runtime does not expose a typed `.ip`
 * property, so we read only from headers to avoid TypeScript errors.
 */
export function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anon'
  );
}
