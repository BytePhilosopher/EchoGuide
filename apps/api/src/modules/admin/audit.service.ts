import type { Database } from '../../shared/database/client';
import { auditLogs } from '../../shared/database/schema';
import type { AuditActorType, AuditOutcome } from '../../shared/database/enums';
import type { Tx } from '../auth/auth.repository';

export type AuditEntry = {
  actorType: AuditActorType;
  actorAdminId?: string | null;
  action: string;
  outcome: AuditOutcome;
  targetUserId?: string | null;
  requestId?: string | null;
  // Identifiers and state transitions only. Never request bodies, tokens, speech or contact data.
  metadata?: Record<string, string | number | boolean | null>;
};

export type AuditRecord = AuditEntry & { id: string; createdAt: Date };

/** Append-only audit log. Owned by the admin module; other modules write through this service. */
export class AuditService {
  constructor(private readonly db: Database) {}

  async record(entry: AuditEntry, tx: Tx | Database = this.db): Promise<void> {
    await tx.insert(auditLogs).values({
      actorType: entry.actorType,
      actorAdminId: entry.actorAdminId ?? null,
      action: entry.action,
      outcome: entry.outcome,
      targetUserId: entry.targetUserId ?? null,
      requestId: entry.requestId ?? null,
      metadata: entry.metadata ?? {},
    });
  }
}
