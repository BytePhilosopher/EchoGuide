import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { Database } from '../../shared/database/client';
import { ACTIVE_DELETION_JOB_STATUSES, type DeletionJobStatus } from '../../shared/database/enums';
import { deletionJobs, users } from '../../shared/database/schema';
import { describeError, logStructured } from '../../shared/logger';
import type { RedisKeys } from '../../shared/redis/client';
import type { StorageService } from '../../shared/storage/storage.service';
import type { AuditService } from '../admin/audit.service';

export type DeletionJob = typeof deletionJobs.$inferSelect;

export type DeletionJobView = {
  task_id: string;
  status: DeletionJobStatus;
  created_at: string;
  completed_at: string | null;
};

const LEASE_SECONDS = 300;
const MAX_BACKOFF_SECONDS = 3600;

/**
 * User data deletion (docs: architecture/data, "Deletion").
 *
 * The request marks the account deleted at once (every credential stops working) and records a
 * job in Postgres, which is the durable source of truth. Redis carries only a wake-up signal, so
 * losing it delays a job by one poll interval but never loses it.
 *
 * The worker removes the user's objects from storage first, then deletes the user row, which
 * cascades to devices, sessions, preferences, consent, app grants, vocabulary, subscriptions and
 * command events. Each step is idempotent, so a retry after a partial run finishes the job instead
 * of failing on what is already gone. The job is only marked completed once every step has
 * succeeded; a failure is retried with exponential backoff up to DELETION_JOB_MAX_ATTEMPTS.
 */
export class DeletionService {
  constructor(
    private readonly db: Database,
    private readonly redis: Redis,
    private readonly keys: RedisKeys,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly maxAttempts: number,
  ) {}

  /** Idempotent: a repeated request returns the job already in flight. */
  async requestDeletion(userId: string, requestId: string): Promise<DeletionJob> {
    const job = await this.db.transaction(async (tx) => {
      await tx.update(users).set({ deletedAt: sql`coalesce(${users.deletedAt}, now())` }).where(eq(users.id, userId));
      const inserted = await tx
        .insert(deletionJobs)
        .values({ userId, type: 'user_data' })
        .onConflictDoNothing({
          target: deletionJobs.userId,
          where: sql`status IN ('queued', 'running', 'retrying')`,
        })
        .returning();
      if (inserted[0]) {
        await this.audit.record(
          { actorType: 'user', action: 'user.deletion.requested', outcome: 'success', targetUserId: userId, requestId, metadata: { job_id: inserted[0].id } },
          tx,
        );
        return inserted[0];
      }
      const [existing] = await tx
        .select()
        .from(deletionJobs)
        .where(and(eq(deletionJobs.userId, userId), inArray(deletionJobs.status, [...ACTIVE_DELETION_JOB_STATUSES])))
        .limit(1);
      return existing;
    });
    await this.signal(job.id);
    return job;
  }

  async signal(jobId: string): Promise<void> {
    try {
      await this.redis.lpush(this.keys.deletionQueue(), jobId);
    } catch (error) {
      // Postgres holds the job; the worker's poll picks it up without the signal.
      logStructured('deletion.signal_failed', describeError(error));
    }
  }

  async getJob(jobId: string): Promise<DeletionJobView | null> {
    const [job] = await this.db.select().from(deletionJobs).where(eq(deletionJobs.id, jobId)).limit(1);
    if (!job) return null;
    return {
      task_id: job.id,
      status: job.status as DeletionJobStatus,
      created_at: job.createdAt.toISOString(),
      completed_at: job.completedAt?.toISOString() ?? null,
    };
  }

  /** Claims one due job. Also reclaims a job whose worker died mid-run (lease expired). */
  async claimNext(): Promise<DeletionJob | null> {
    const due = this.db
      .select({ id: deletionJobs.id })
      .from(deletionJobs)
      .where(
        or(
          and(inArray(deletionJobs.status, ['queued', 'retrying']), lte(deletionJobs.nextAttemptAt, sql`now()`)),
          and(eq(deletionJobs.status, 'running'), lte(deletionJobs.lockedUntil, sql`now()`)),
        ),
      )
      .orderBy(deletionJobs.nextAttemptAt)
      .limit(1)
      .for('update', { skipLocked: true });
    const rows = await this.db
      .update(deletionJobs)
      .set({
        status: 'running',
        startedAt: sql`coalesce(${deletionJobs.startedAt}, now())`,
        attempts: sql`${deletionJobs.attempts} + 1`,
        lockedUntil: sql`now() + make_interval(secs => ${LEASE_SECONDS})`,
      })
      .where(inArray(deletionJobs.id, due))
      .returning();
    return rows[0] ?? null;
  }

  async process(job: DeletionJob): Promise<'completed' | 'retrying' | 'failed'> {
    try {
      const { deleted } = await this.storage.deleteUserObjects(job.userId);
      await this.db.transaction(async (tx) => {
        await tx.delete(users).where(eq(users.id, job.userId));
        await tx
          .update(deletionJobs)
          .set({ status: 'completed', completedAt: sql`now()`, lockedUntil: null, lastError: null })
          .where(eq(deletionJobs.id, job.id));
        await this.audit.record(
          {
            actorType: 'system',
            action: 'user.deletion.completed',
            outcome: 'success',
            targetUserId: job.userId,
            metadata: { job_id: job.id, attempts: job.attempts, storage_driver: this.storage.driver, storage_objects: deleted },
          },
          tx,
        );
      });
      logStructured('deletion.job.completed', { job_id: job.id, attempts: job.attempts });
      return 'completed';
    } catch (error) {
      const described = describeError(error);
      const terminal = job.attempts >= this.maxAttempts;
      const backoff = Math.min(MAX_BACKOFF_SECONDS, 2 ** Math.min(job.attempts, 12));
      await this.db
        .update(deletionJobs)
        .set({
          status: terminal ? 'failed' : 'retrying',
          failedAt: sql`now()`,
          lastError: `${described.error_name}${described.error_code !== undefined ? `:${described.error_code}` : ''}`.slice(0, 200),
          nextAttemptAt: sql`now() + make_interval(secs => ${backoff})`,
          lockedUntil: null,
        })
        .where(eq(deletionJobs.id, job.id));
      // `failed` pages someone: the user has been told deletion is not complete until it is.
      logStructured(terminal ? 'deletion.job.failed' : 'deletion.job.retrying', { job_id: job.id, attempts: job.attempts, ...described });
      return terminal ? 'failed' : 'retrying';
    }
  }

  /** Processes due jobs until none remain. Returns how many were handled. */
  async drain(limit = 50): Promise<number> {
    let handled = 0;
    while (handled < limit) {
      const job = await this.claimNext();
      if (!job) break;
      await this.process(job);
      handled += 1;
    }
    return handled;
  }
}

