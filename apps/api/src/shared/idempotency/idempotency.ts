import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import { RedisKeys } from '../redis/client';
import { describeError, logStructured } from '../logger';

export type StoredResponse = { status: number; body: unknown };

type Record =
  | { state: 'pending'; fingerprint: string }
  | { state: 'done'; fingerprint: string; response: StoredResponse };

export type BeginResult =
  | { kind: 'execute'; lease: IdempotencyLease | null }
  | { kind: 'replay'; response: StoredResponse }
  | { kind: 'mismatch' }
  | { kind: 'in_progress' };

export type IdempotencyLease = {
  complete(response: StoredResponse): Promise<void>;
  release(): Promise<void>;
};

export function fingerprintOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Idempotency records in Redis, shared across instances.
 *
 * - The first request claims the key with SET NX and a short lock TTL, then executes.
 * - A duplicate that arrives while the first is running waits for its result instead of running
 *   the command a second time; if it never arrives it gets `in_progress` (409).
 * - A completed response is replayed for `ttlSeconds`. Only responses below 500 are stored, so a
 *   provider outage does not pin a failure to the key; the retry runs again.
 * - Reusing a key with a different body is refused (`mismatch`, 422).
 *
 * Stored responses can contain an action plan, whose TEXT_INPUT payload is text the user
 * dictated, so the TTL is deliberately short: long enough to absorb a client retry, no longer.
 *
 * If Redis is unavailable the command runs without de-duplication and an alert is logged,
 * matching the documented failure table (Redis down never blocks a user's command).
 */
export class IdempotencyStore {
  constructor(
    private readonly redis: Redis,
    private readonly keys: RedisKeys,
    private readonly options: { ttlSeconds: number; lockSeconds: number; waitMs: number; pollMs?: number },
  ) {}

  async begin(scope: string, key: string, fingerprint: string): Promise<BeginResult> {
    const redisKey = this.keys.idempotency(scope, key);
    try {
      const pending: Record = { state: 'pending', fingerprint };
      const claimed = await this.redis.set(redisKey, JSON.stringify(pending), 'PX', this.options.lockSeconds * 1000, 'NX');
      if (claimed === 'OK') return { kind: 'execute', lease: this.lease(redisKey, fingerprint) };
      return await this.awaitExisting(redisKey, fingerprint);
    } catch (error) {
      logStructured('idempotency.unavailable', describeError(error));
      return { kind: 'execute', lease: null };
    }
  }

  private async awaitExisting(redisKey: string, fingerprint: string): Promise<BeginResult> {
    const deadline = Date.now() + this.options.waitMs;
    const pollMs = this.options.pollMs ?? 100;
    for (;;) {
      const raw = await this.redis.get(redisKey);
      if (raw === null) {
        // The first attempt released its claim (it failed); this one may run.
        const pending: Record = { state: 'pending', fingerprint };
        const claimed = await this.redis.set(redisKey, JSON.stringify(pending), 'PX', this.options.lockSeconds * 1000, 'NX');
        if (claimed === 'OK') return { kind: 'execute', lease: this.lease(redisKey, fingerprint) };
        continue;
      }
      const record = JSON.parse(raw) as Record;
      if (record.fingerprint !== fingerprint) return { kind: 'mismatch' };
      if (record.state === 'done') return { kind: 'replay', response: record.response };
      if (Date.now() >= deadline) return { kind: 'in_progress' };
      await sleep(pollMs);
    }
  }

  private lease(redisKey: string, fingerprint: string): IdempotencyLease {
    return {
      complete: async (response) => {
        try {
          if (response.status >= 500) {
            await this.redis.del(redisKey);
            return;
          }
          const done: Record = { state: 'done', fingerprint, response };
          await this.redis.set(redisKey, JSON.stringify(done), 'PX', this.options.ttlSeconds * 1000);
        } catch (error) {
          logStructured('idempotency.store_failed', describeError(error));
        }
      },
      release: async () => {
        try {
          await this.redis.del(redisKey);
        } catch (error) {
          logStructured('idempotency.release_failed', describeError(error));
        }
      },
    };
  }
}
