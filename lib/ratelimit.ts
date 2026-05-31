import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/redis';

// Module-level singleton so the ephemeral cache is shared across warm invocations.
// fixedWindow: 10 requests per 60-second window per identifier.
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, '60 s'),
  analytics: false,
});
