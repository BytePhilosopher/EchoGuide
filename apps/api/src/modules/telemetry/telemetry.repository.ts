import { getDb } from '../../shared/database/client';
import { commandEvents } from '../../shared/database/schema';
import { logStructured } from '../../shared/logger';

export type TelemetryRecord = {
  id: string;
  userId: string;
  outcome: 'done' | 'failed' | 'rejected' | 'blocked' | 'cancelled';
  durationMs: number;
  confidence: number | null;
  stageTimings: Record<string, number>;
};

export async function insertCommandEvents(records: TelemetryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = getDb();
  if (!db) return;
  await db.insert(commandEvents).values(
    records.map((record) => ({
      id: record.id,
      userId: record.userId,
      outcome: record.outcome,
      durationMs: record.durationMs,
      confidence: record.confidence,
      stageTimings: record.stageTimings,
    })),
  );
}

export function logTelemetryFailure(error: unknown): void {
  logStructured('telemetry.flush.failed', {
    error: error instanceof Error ? error.message : 'unknown',
  });
}
