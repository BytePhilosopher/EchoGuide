import { z } from 'zod';
import { insertCommandEvents, logTelemetryFailure, type TelemetryRecord } from './telemetry.repository';

export const CommandEventSchema = z
  .object({
    request_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    outcome: z.enum(['done', 'failed', 'rejected', 'blocked', 'cancelled']),
    duration_ms: z.number().int().min(0),
    confidence: z.number().optional(),
    stage_timings: z.record(z.number().int().min(0)).default({}),
  })
  .strict();

export type CommandEventInput = z.infer<typeof CommandEventSchema>;

const BUFFER_MAX = 1000;
const buffer: TelemetryRecord[] = [];
let flushing = false;

function enqueue(record: TelemetryRecord): void {
  if (buffer.length >= BUFFER_MAX) buffer.shift();
  buffer.push(record);
  if (!flushing) {
    flushing = true;
    setImmediate(() => {
      void flush();
    });
  }
}

async function flush(): Promise<void> {
  const batch = buffer.splice(0, 100);
  try {
    await insertCommandEvents(batch);
  } catch (error) {
    logTelemetryFailure(error);
    for (const record of batch) {
      if (buffer.length >= BUFFER_MAX) break;
      buffer.push(record);
    }
  } finally {
    flushing = buffer.length > 0;
    if (flushing) {
      setImmediate(() => {
        void flush();
      });
    }
  }
}

export function emit(event: CommandEventInput): void {
  try {
    const parsed = CommandEventSchema.safeParse(event);
    if (!parsed.success || !parsed.data.user_id) return;
    enqueue({
      id: parsed.data.request_id,
      userId: parsed.data.user_id,
      outcome: parsed.data.outcome,
      durationMs: parsed.data.duration_ms,
      confidence: parsed.data.confidence ?? null,
      stageTimings: parsed.data.stage_timings,
    });
  } catch {
    return;
  }
}
