import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Single shared Ratelimit instance using a fixed-window strategy.
 * Allows 10 requests per 60-second window per identifier (user ID or IP).
 *
 * Requires the following environment variables to be set:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, '60 s'),
  analytics: true,
  prefix: 'ratelimit',
});
