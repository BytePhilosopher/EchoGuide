import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../shared/database/client';
import { users } from '../../shared/database/schema';
import { conflict, notFound } from '../../shared/errors';
import { isUuid } from '../../shared/http';
import type { AuditService } from './audit.service';

export type AdminUserView = {
  userId: string;
  status: 'active' | 'suspended' | 'deleted';
  registered_at: string;
  suspended_at: string | null;
};

type Actor = { adminId: string; requestId: string };

/**
 * Support actions. Every call — success, not-found or conflict — writes an audit row, in the same
 * transaction as the change it describes, so an action and its audit record commit together.
 */
export class AdminService {
  constructor(
    private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  private view(row: { id: string; status: string; createdAt: Date; suspendedAt: Date | null; deletedAt: Date | null }): AdminUserView {
    return {
      userId: row.id,
      status: row.deletedAt ? 'deleted' : row.status === 'suspended' ? 'suspended' : 'active',
      registered_at: row.createdAt.toISOString(),
      suspended_at: row.suspendedAt?.toISOString() ?? null,
    };
  }

  async getUser(actor: Actor, userId: string): Promise<AdminUserView> {
    const row = await this.db.transaction(async (tx) => {
      const found = isUuid(userId)
        ? (
            await tx
              .select({ id: users.id, status: users.status, createdAt: users.createdAt, suspendedAt: users.suspendedAt, deletedAt: users.deletedAt })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1)
          )[0]
        : undefined;
      await this.audit.record(
        {
          actorType: 'admin',
          actorAdminId: actor.adminId,
          action: 'users.read',
          outcome: found ? 'success' : 'not_found',
          targetUserId: found?.id ?? null,
          requestId: actor.requestId,
        },
        tx,
      );
      return found;
    });
    // Thrown after commit: throwing inside the transaction would roll back the not_found audit row.
    if (!row) throw notFound('User not found');
    return this.view(row);
  }

  async setSuspended(actor: Actor, userId: string, suspended: boolean): Promise<{ status: 'suspended' | 'active'; userId: string }> {
    const action = suspended ? 'users.suspend' : 'users.reinstate';
    const outcome = await this.db.transaction(async (tx) => {
      const row = isUuid(userId)
        ? (
            await tx
              .select({ id: users.id, status: users.status, deletedAt: users.deletedAt })
              .from(users)
              .where(eq(users.id, userId))
              .for('update')
              .limit(1)
          )[0]
        : undefined;
      const base = { actorType: 'admin' as const, actorAdminId: actor.adminId, action, requestId: actor.requestId };
      if (!row) {
        await this.audit.record({ ...base, outcome: 'not_found' }, tx);
        return 'not_found' as const;
      }
      if (row.deletedAt) {
        await this.audit.record({ ...base, outcome: 'conflict', targetUserId: row.id, metadata: { reason: 'deletion_in_progress' } }, tx);
        return 'deleting' as const;
      }
      const target = suspended ? 'suspended' : 'active';
      const alreadyThere = row.status === target;
      if (!alreadyThere) {
        await tx
          .update(users)
          .set(suspended ? { status: 'suspended', suspendedAt: sql`now()` } : { status: 'active', suspendedAt: null })
          .where(eq(users.id, row.id));
      }
      // Sessions are kept, not revoked: a suspended device keeps getting 403 "suspended" instead
      // of a 401 that would prompt it to register a fresh install and walk around the suspension.
      await this.audit.record(
        { ...base, outcome: 'success', targetUserId: row.id, metadata: { previous_status: row.status, changed: !alreadyThere } },
        tx,
      );
      return 'ok' as const;
    });
    if (outcome === 'not_found') throw notFound('User not found');
    if (outcome === 'deleting') throw conflict('User is being deleted');
    return { status: suspended ? 'suspended' : 'active', userId };
  }
}
