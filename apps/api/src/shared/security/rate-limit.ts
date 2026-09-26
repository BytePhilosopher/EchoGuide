import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type Redis from 'ioredis';
import { RedisKeys } from '../redis/client';
import { describeError, logStructured } from '../logger';

// INCR and set the expiry in one atomic step, so a crash between them cannot leave an immortal key.
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

export type RateLimitDecision =
  | { allowed: true; limit: number; remaining: number; resetSeconds: number }
  | { allowed: false; limit: number; remaining: 0; resetSeconds: number }
  | { allowed: true; degraded: true };

/**
 * Fixed-window counters in Redis, keyed by bucket and caller, shared by every API instance.
 * The key is the caller (IP or user), never the connection, so opening more sockets buys nothing.
 */
export class RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly keys: RedisKeys,
    private readonly windowSeconds: number,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(bucket: string, id: string, limit: number): Promise<RateLimitDecision> {
    const windowMs = this.windowSeconds * 1000;
    const window = Math.floor(this.now() / windowMs);
    const key = this.keys.rateLimit(bucket, id, window);
    try {
      const [count, ttl] = (await this.redis.eval(INCREMENT_SCRIPT, 1, key, String(windowMs))) as [number, number];
      const resetSeconds = Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000));
      if (count > limit) return { allowed: false, limit, remaining: 0, resetSeconds };
      return { allowed: true, limit, remaining: Math.max(0, limit - count), resetSeconds };
    } catch (error) {
      // Failure table: Redis down means no rate limiting, and an alert. Never a failed command.
      logStructured('rate_limit.unavailable', { bucket, ...describeError(error) });
      return { allowed: true, degraded: true };
    }
  }

  middleware(bucket: string, limit: number, identify: (req: Request) => string | null): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const id = identify(req);
      if (!id) {
        next();
        return;
      }
      this.consume(bucket, id, limit)
        .then((decision) => {
          if ('degraded' in decision) {
            next();
            return;
          }
          res.setHeader('RateLimit-Limit', String(decision.limit));
          res.setHeader('RateLimit-Remaining', String(decision.remaining));
          res.setHeader('RateLimit-Reset', String(decision.resetSeconds));
          if (!decision.allowed) {
            logStructured('rate_limit.exceeded', { bucket });
            res.setHeader('Retry-After', String(decision.resetSeconds));
            res.status(429).json({ error: 'Too many requests' });
            return;
          }
          next();
        })
        .catch(next);
    };
  }
}

/** The client address as Express resolves it under the configured `trust proxy` setting. */
export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}
