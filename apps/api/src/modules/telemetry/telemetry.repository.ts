import type { Database } from '../../shared/database/client';
import { commandEvents } from '../../shared/database/schema';

export type TelemetryRecord = {
  id: string;
  userId: string;
  outcome: 'done' | 'failed' | 'rejected' | 'blocked' | 'cancelled';
  durationMs: number;
  confidence: number | null;
  stageTimings: Record<string, number>;
};

export class TelemetryRepository {
  constructor(private readonly db: Database) {}

  async insertCommandEvents(records: TelemetryRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.db.insert(commandEvents).values(
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
}
