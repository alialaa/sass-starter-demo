import { Redis } from '@upstash/redis';

// Module-level singleton — reused across warm invocations.
export const redis = Redis.fromEnv();
