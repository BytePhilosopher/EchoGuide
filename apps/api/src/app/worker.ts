import 'dotenv/config';
import type Redis from 'ioredis';
import { parseConfig } from '../shared/config';
import { describeError, logStructured } from '../shared/logger';
import { createRedis } from '../shared/redis/client';
import { createContainer, type Container } from './container';

/**
 * Background work: deletion jobs and the telemetry flush. Runs inside each API process by default
 * (WORKER_ENABLED=true) or on its own via `npm run start:worker`. Safe to run on many instances at
 * once: jobs are claimed with FOR UPDATE SKIP LOCKED and telemetry batches with an atomic RPOP.
 */
export class Worker {
  private running = false;
  private blocking: Redis | null = null;
  private loops: Promise<void>[] = [];

  constructor(private readonly c: Container) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.blocking = createRedis(this.c.config.redisUrl, { blocking: true });
    this.loops = [this.deletionLoop(), this.telemetryLoop()];
    logStructured('worker.started');
  }

  async stop(): Promise<void> {
    this.running = false;
    this.blocking?.disconnect();
    await Promise.allSettled(this.loops);
    logStructured('worker.stopped');
  }

  private async deletionLoop(): Promise<void> {
    const timeoutSeconds = Math.max(1, Math.round(this.c.config.worker.pollIntervalMs / 1000));
    while (this.running) {
      try {
        await this.c.deletion.drain();
        // Wait for a signal, or poll again after the interval if none arrives (or Redis is down).
        await this.blocking?.brpop(this.c.keys.deletionQueue(), timeoutSeconds);
      } catch (error) {
        if (!this.running) break;
        logStructured('worker.deletion_loop_error', describeError(error));
        await sleep(this.c.config.worker.pollIntervalMs);
      }
    }
  }

  private async telemetryLoop(): Promise<void> {
    while (this.running) {
      try {
        const written = await this.c.telemetry.flushOnce();
        if (written === 0) await sleep(1000);
      } catch {
        await sleep(this.c.config.worker.pollIntervalMs);
      }
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

if (require.main === module) {
  const config = parseConfig(process.env);
  const container = createContainer(config);
  const worker = new Worker(container);
  worker.start();
  const shutdown = () => {
    void worker.stop().then(() => container.close()).then(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
