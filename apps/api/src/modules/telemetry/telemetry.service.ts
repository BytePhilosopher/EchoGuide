import type Redis from 'ioredis';
import { z } from 'zod';
import { PG_FOREIGN_KEY_VIOLATION, pgErrorCode } from '../../shared/database/errors';
import { describeError, logStructured } from '../../shared/logger';
import type { RedisKeys } from '../../shared/redis/client';
import type { TelemetryRecord, TelemetryRepository } from './telemetry.repository';

export const CommandEventSchema = z
  .object({
    request_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    outcome: z.enum(['done', 'failed', 'rejected', 'blocked', 'cancelled']),
    duration_ms: z.number().int().min(0).max(24 * 3600 * 1000),
    confidence: z.number().min(0).max(1).optional(),
    stage_timings: z
      .record(z.string().regex(/^[a-z_]{1,32}$/), z.number().int().min(0).max(24 * 3600 * 1000))
      .refine((value) => Object.keys(value).length <= 16)
      .default({}),
  })
  .strict();

export type CommandEventInput = z.infer<typeof CommandEventSchema>;

const FLUSH_BATCH = 100;

/**
 * Command outcome events. Never transcripts or audio: the schema is strict and has no field
 * that could carry them.
 *
 * Events go to a capped Redis list, shared by every instance and surviving restarts, and the
 * worker moves them into command_events in batches. Telemetry never blocks or fails a command:
 * if Redis is down the event is dropped and an alert is logged; if Postgres is down the batch is
 * pushed back and retried (the "Postgres down → events buffered" row of the failure table).
 */
export class TelemetryService {
  constructor(
    private readonly redis: Redis,
    private readonly keys: RedisKeys,
    private readonly repo: TelemetryRepository,
    private readonly bufferMax: number,
  ) {}

  emit(event: CommandEventInput): void {
    const parsed = CommandEventSchema.safeParse(event);
    if (!parsed.success || !parsed.data.user_id) return;
    const record: TelemetryRecord = {
      id: parsed.data.request_id,
      userId: parsed.data.user_id,
      outcome: parsed.data.outcome,
      durationMs: parsed.data.duration_ms,
      confidence: parsed.data.confidence ?? null,
      stageTimings: parsed.data.stage_timings,
    };
    const key = this.keys.telemetryBuffer();
    this.redis
      .multi()
      .lpush(key, JSON.stringify(record))
      .ltrim(key, 0, this.bufferMax - 1)
      .exec()
      .catch((error: unknown) => logStructured('telemetry.buffer.unavailable', describeError(error)));
  }

  /** Moves up to one batch from Redis into Postgres. Returns the number of events written. */
  async flushOnce(): Promise<number> {
    const key = this.keys.telemetryBuffer();
    const raw = (await this.redis.rpop(key, FLUSH_BATCH)) ?? [];
    if (raw.length === 0) return 0;
    const records: TelemetryRecord[] = [];
    for (const item of raw) {
      try {
        records.push(JSON.parse(item) as TelemetryRecord);
      } catch {
        // A corrupt entry is dropped rather than blocking the queue.
      }
    }
    try {
      await this.repo.insertCommandEvents(records);
      return records.length;
    } catch (error) {
      // The user was deleted before the event was written. Nothing to keep for them.
      if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
        await this.insertIndividually(records);
        return records.length;
      }
      logStructured('telemetry.flush.failed', describeError(error));
      await this.redis.rpush(key, ...raw.reverse()).catch(() => undefined);
      throw error;
    }
  }

  private async insertIndividually(records: TelemetryRecord[]): Promise<void> {
    for (const record of records) {
      await this.repo.insertCommandEvents([record]).catch(() => undefined);
    }
  }
}
