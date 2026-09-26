import Redis from 'ioredis';
import { describeError, logStructured } from '../logger';

/**
 * Redis holds rate limits, idempotency records, the telemetry buffer and the job wake-up queue.
 * It is never authoritative (Postgres is). Commands fail fast instead of queueing while Redis is
 * down, so callers can degrade as the failure table says rather than hang a user's command.
 */
export function createRedis(url: string, options: { blocking?: boolean } = {}): Redis {
  const client = new Redis(url, {
    lazyConnect: false,
    enableOfflineQueue: options.blocking === true,
    maxRetriesPerRequest: options.blocking ? null : 1,
    connectTimeout: 2000,
    commandTimeout: options.blocking ? undefined : 1000,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  let warned = false;
  client.on('error', (error) => {
    if (warned) return;
    warned = true;
    logStructured('redis.error', describeError(error));
  });
  client.on('ready', () => {
    warned = false;
  });
  return client;
}

export class RedisKeys {
  constructor(private readonly prefix: string) {}

  rateLimit(bucket: string, id: string, window: number): string {
    return `${this.prefix}rl:${bucket}:${id}:${window}`;
  }

  idempotency(scope: string, key: string): string {
    return `${this.prefix}idem:${scope}:${key}`;
  }

  telemetryBuffer(): string {
    return `${this.prefix}telemetry:events`;
  }

  deletionQueue(): string {
    return `${this.prefix}jobs:deletion`;
  }
}

/** Resolves true once the client is connected, false if it is not ready within `timeoutMs`. */
export function waitForRedis(client: Redis, timeoutMs: number): Promise<boolean> {
  if (client.status === 'ready') return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      client.off('ready', onReady);
      resolve(false);
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve(true);
    };
    client.once('ready', onReady);
  });
}
