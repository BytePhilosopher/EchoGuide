import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { zConsentCurrentResponse, zDeletionResponse } from '@echoguide/openapi';
import { Worker } from '../../app/worker';
import { appGrants, auditLogs, commandEvents, consentGrants, deletionJobs, devices, users, vocabularyTerms } from '../../shared/database/schema';
import type { StorageService } from '../../shared/storage/storage.service';
import { startHarness, type Harness, type TestUser } from '../harness';

class FlakyStorage implements StorageService {
  readonly driver = 'flaky-test-double';
  failuresLeft = 0;
  deletedFor: string[] = [];
  async putUserObject(): Promise<void> {}
  async deleteUserObjects(userId: string): Promise<{ deleted: number }> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw Object.assign(new Error('storage unreachable'), { code: 'ECONNRESET' });
    }
    this.deletedFor.push(userId);
    return { deleted: 0 };
  }
}

const exists = (path: string) => stat(path).then(() => true, () => false);

describe('consent', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness();
  });
  after(async () => {
    await h.close();
  });

  test('grants are append-only and the latest row wins, per user', async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    const post = (user: TestUser, granted: boolean) =>
      h.json('/v1/consent/grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...user.headers },
        body: JSON.stringify({ scope: 'audio_retention', granted }),
      });
    assert.deepEqual((await post(a, true)).body, { status: 'recorded', scope: 'audio_retention', granted: true });
    await post(a, false);
    const current = await h.json('/v1/consent/grants/current?scope=audio_retention', { headers: a.headers });
    zConsentCurrentResponse.parse(current.body);
    assert.equal(current.body.granted, false);
    const rows = await h.c.db.select().from(consentGrants).where(eq(consentGrants.userId, a.userId));
    assert.equal(rows.length, 2);
    const other = await h.json('/v1/consent/grants/current?scope=audio_retention', { headers: b.headers });
    assert.equal(other.body.granted, false);
    assert.equal(other.body.created_at, null);
  });

  test('a user id in the body is refused, never honoured', async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    const res = await h.fetch('/v1/consent/grants', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...a.headers },
      body: JSON.stringify({ scope: 'audio_retention', granted: true, user_id: b.userId }),
    });
    assert.equal(res.status, 400);
    assert.equal((await h.c.db.select().from(consentGrants).where(eq(consentGrants.userId, b.userId))).length, 0);
  });
});

describe('user data deletion', () => {
  let h: Harness;
  const storage = new FlakyStorage();
  before(async () => {
    h = await startHarness({ env: { DELETION_JOB_MAX_ATTEMPTS: '3' }, overrides: { storage } });
  });
  after(async () => {
    await h.close();
  });
  beforeEach(() => {
    storage.failuresLeft = 0;
    storage.deletedFor = [];
  });

  async function populatedUser(): Promise<TestUser> {
    const user = await h.registerUser();
    await h.c.db.insert(appGrants).values({ userId: user.userId, packageName: 'com.whatsapp', granted: true });
    await h.c.db.insert(consentGrants).values({ userId: user.userId, scope: 'audio_retention', granted: true });
    await h.c.db.insert(vocabularyTerms).values({ userId: user.userId, term: 'Abebe', kind: 'contact' });
    await h.c.db.insert(commandEvents).values({ id: randomUUID(), userId: user.userId, outcome: 'done', durationMs: 10 });
    return user;
  }

  test('DELETE creates a durable job, blocks the account at once, and signals the worker through Redis', async () => {
    const user = await populatedUser();
    const res = await h.json<{ status: string; task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    assert.equal(res.status, 202);
    zDeletionResponse.parse(res.body);
    assert.equal(res.body.status, 'deletion_queued');
    assert.doesNotMatch(res.body.task_id, /^del-job-/);

    const [job] = await h.c.db.select().from(deletionJobs).where(eq(deletionJobs.id, res.body.task_id));
    assert.equal(job.userId, user.userId);
    assert.equal(job.status, 'queued');
    assert.equal(await h.c.redis.lindex(h.c.keys.deletionQueue(), 0), job.id);

    // Credentials stop working immediately, before the worker runs.
    assert.equal((await h.fetch('/v1/users/me', { headers: user.headers })).status, 401);
    const [audit] = await h.c.db.select().from(auditLogs).where(eq(auditLogs.targetUserId, user.userId));
    assert.equal(audit.action, 'user.deletion.requested');
  });

  test('a repeated request returns the same job instead of creating a second one', async () => {
    const user = await populatedUser();
    const first = await h.json<{ task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    const second = await h.json<{ task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    assert.equal(second.status, 202);
    assert.equal(second.body.task_id, first.body.task_id);
    const jobs = await h.c.db.select().from(deletionJobs).where(eq(deletionJobs.userId, user.userId));
    assert.equal(jobs.length, 1);
  });

  test('processing deletes every row by cascade, removes storage, and only then reports completed', async () => {
    const user = await populatedUser();
    const { body } = await h.json<{ task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });

    const before = await h.json<{ status: string }>(`/v1/consent/user-data/jobs/${body.task_id}`);
    assert.equal(before.body.status, 'queued');

    assert.ok((await h.c.deletion.drain()) >= 1);
    assert.ok(storage.deletedFor.includes(user.userId));
    for (const table of [users, devices, appGrants, consentGrants, vocabularyTerms, commandEvents] as const) {
      const column = table === users ? users.id : (table as typeof appGrants).userId;
      const rows = await h.c.db.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(column, user.userId));
      assert.equal(rows[0].n, 0);
    }

    const done = await h.json<{ status: string; completed_at: string | null }>(`/v1/consent/user-data/jobs/${body.task_id}`);
    assert.equal(done.body.status, 'completed');
    assert.ok(done.body.completed_at);
    const audit = await h.c.db.select().from(auditLogs).where(eq(auditLogs.targetUserId, user.userId));
    assert.deepEqual(audit.map((a) => a.action).sort(), ['user.deletion.completed', 'user.deletion.requested']);
  });

  test('a storage failure leaves the job retrying, not completed, and the retry finishes it', async () => {
    const user = await populatedUser();
    const { body } = await h.json<{ task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    storage.failuresLeft = 1;
    await h.c.deletion.drain();

    const [failed] = await h.c.db.select().from(deletionJobs).where(eq(deletionJobs.id, body.task_id));
    assert.equal(failed.status, 'retrying');
    assert.equal(failed.attempts, 1);
    assert.equal(failed.lastError, 'Error:ECONNRESET');
    assert.ok(failed.failedAt);
    assert.equal((await h.c.db.select().from(users).where(eq(users.id, user.userId))).length, 1, 'user row kept until storage is clean');
    assert.equal((await h.json<{ status: string }>(`/v1/consent/user-data/jobs/${body.task_id}`)).body.status, 'retrying');

    // Not due yet: backoff is respected.
    assert.equal(await h.c.deletion.drain(), 0);
    await h.c.db.update(deletionJobs).set({ nextAttemptAt: sql`now()` }).where(eq(deletionJobs.id, body.task_id));
    assert.equal(await h.c.deletion.drain(), 1);
    const [done] = await h.c.db.select().from(deletionJobs).where(eq(deletionJobs.id, body.task_id));
    assert.equal(done.status, 'completed');
    assert.equal(done.attempts, 2);
    assert.equal(done.lastError, null);
  });

  test('retrying after a partial run is idempotent: an already-deleted user completes cleanly', async () => {
    const user = await populatedUser();
    const { body } = await h.json<{ task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    // Simulate a worker that deleted the rows and died before marking the job complete.
    await h.c.db.delete(users).where(eq(users.id, user.userId));
    await h.c.db.update(deletionJobs).set({ status: 'running', lockedUntil: sql`now() - interval '1 second'` }).where(eq(deletionJobs.id, body.task_id));
    assert.equal(await h.c.deletion.drain(), 1, 'an expired lease is reclaimed');
    const [job] = await h.c.db.select().from(deletionJobs).where(eq(deletionJobs.id, body.task_id));
    assert.equal(job.status, 'completed');
  });

  test('a job that keeps failing ends as failed after the attempt limit, and says so', async () => {
    const user = await populatedUser();
    const { body } = await h.json<{ task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    storage.failuresLeft = 10;
    for (let i = 0; i < 3; i += 1) {
      await h.c.db.update(deletionJobs).set({ nextAttemptAt: sql`now()` }).where(eq(deletionJobs.id, body.task_id));
      await h.c.deletion.drain();
    }
    const [job] = await h.c.db.select().from(deletionJobs).where(eq(deletionJobs.id, body.task_id));
    assert.equal(job.status, 'failed');
    assert.equal(job.attempts, 3);
    assert.equal((await h.json<{ status: string }>(`/v1/consent/user-data/jobs/${body.task_id}`)).body.status, 'failed');
    assert.ok(h.logs.some((l) => l.includes('"event":"deletion.job.failed"')));
  });

  test('two workers never process the same job', async () => {
    const user = await populatedUser();
    await h.fetch('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    const [a, b] = await Promise.all([h.c.deletion.claimNext(), h.c.deletion.claimNext()]);
    assert.equal([a, b].filter(Boolean).length, 1);
    await h.c.deletion.process((a ?? b)!);
  });

  test('the worker loop picks a job up from the Redis signal', async () => {
    const user = await populatedUser();
    const worker = new Worker(h.c);
    worker.start();
    try {
      const { body } = await h.json<{ task_id: string }>('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
      let status = '';
      for (let i = 0; i < 50 && status !== 'completed'; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        status = (await h.json<{ status: string }>(`/v1/consent/user-data/jobs/${body.task_id}`)).body.status;
      }
      assert.equal(status, 'completed');
    } finally {
      await worker.stop();
    }
  });

  test('job status is only readable by its unguessable id', async () => {
    assert.equal((await h.fetch(`/v1/consent/user-data/jobs/${randomUUID()}`)).status, 404);
    assert.equal((await h.fetch('/v1/consent/user-data/jobs/1')).status, 404);
  });
});

describe('local storage deletion', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness();
  });
  after(async () => {
    await h.close();
  });

  test("the user's objects are removed from storage and other users' are untouched", async () => {
    const user = await h.registerUser();
    const other = await h.registerUser();
    await h.c.storage.putUserObject(user.userId, 'retained.wav', new Uint8Array([1, 2, 3]));
    await h.c.storage.putUserObject(other.userId, 'retained.wav', new Uint8Array([1]));
    const root = h.c.config.storage.localDir!;
    await h.fetch('/v1/consent/user-data', { method: 'DELETE', headers: user.headers });
    await h.c.deletion.drain();
    assert.equal(await exists(join(root, 'users', user.userId)), false);
    assert.equal(await exists(join(root, 'users', other.userId, 'retained.wav')), true);
  });
});

describe('telemetry', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness();
  });
  after(async () => {
    await h.close();
  });

  const send = (user: TestUser | null, body: unknown) =>
    h.fetch('/v1/telemetry/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(user?.headers ?? {}) },
      body: JSON.stringify(body),
    });

  test('events are buffered in Redis and flushed to command_events for the authenticated user', async () => {
    const user = await h.registerUser();
    const requestId = randomUUID();
    const res = await send(user, { request_id: requestId, outcome: 'done', duration_ms: 1200, stage_timings: { capture: 400, upload: 800 } });
    assert.equal(res.status, 202);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(await h.c.redis.llen(h.c.keys.telemetryBuffer()), 1, 'buffered in Redis, not process memory');
    assert.equal(await h.c.telemetry.flushOnce(), 1);
    const rows = await h.c.db.select().from(commandEvents).where(eq(commandEvents.id, requestId));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].userId, user.userId);
    assert.deepEqual(rows[0].stageTimings, { capture: 400, upload: 800 });
  });

  test('unauthenticated telemetry → 401', async () => {
    assert.equal((await send(null, { outcome: 'done', duration_ms: 1, stage_timings: {} })).status, 401);
  });

  test('transcripts, audio and client-chosen user ids are refused', async () => {
    const user = await h.registerUser();
    const other = await h.registerUser();
    for (const extra of [{ transcript: 'hello' }, { audio_base64: 'AAAA' }, { user_id: other.userId }]) {
      assert.equal((await send(user, { outcome: 'done', duration_ms: 1, stage_timings: {}, ...extra })).status, 400);
    }
  });

  test('if Postgres rejects a batch it goes back on the buffer instead of being lost', async () => {
    const user = await h.registerUser();
    await send(user, { outcome: 'failed', duration_ms: 5, stage_timings: {} });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const original = h.c.pool.query.bind(h.c.pool);
    (h.c.pool as unknown as { query: unknown }).query = async () => {
      throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    };
    try {
      await assert.rejects(() => h.c.telemetry.flushOnce());
    } finally {
      (h.c.pool as unknown as { query: unknown }).query = original;
    }
    assert.equal(await h.c.redis.llen(h.c.keys.telemetryBuffer()), 1);
    assert.equal(await h.c.telemetry.flushOnce(), 1);
  });
});
