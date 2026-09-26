import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { zAdminUser, zSuspendUserResponse } from '@echoguide/openapi';
import { adminSessions, adminUsers, auditLogs, userPreferences, users } from '../../shared/database/schema';
import { startHarness, commandBody, type Harness } from '../harness';

let h: Harness;
before(async () => {
  h = await startHarness();
});
after(async () => {
  await h.close();
});

const auditFor = (targetUserId: string) =>
  h.c.db.select().from(auditLogs).where(eq(auditLogs.targetUserId, targetUserId)).orderBy(desc(auditLogs.createdAt));

describe('GET /v1/users/me', () => {
  test('each user sees exactly their own profile', async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    assert.notEqual(a.userId, b.userId);
    const meA = await h.json<{ user_id: string }>('/v1/users/me', { headers: a.headers });
    const meB = await h.json<{ user_id: string }>('/v1/users/me', { headers: b.headers });
    assert.equal(meA.body.user_id, a.userId);
    assert.equal(meB.body.user_id, b.userId);
  });

  test('query and body user ids are ignored: user A can never read user B through /me', async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    const viaQuery = await h.json<{ user_id: string }>(`/v1/users/me?user_id=${b.userId}`, { headers: a.headers });
    assert.equal(viaQuery.body.user_id, a.userId);
    const viaHeader = await h.json<{ user_id: string }>('/v1/users/me', { headers: { ...a.headers, 'x-user-id': b.userId } });
    assert.equal(viaHeader.body.user_id, a.userId);
  });

  test('returns the stored locale and preferences, not hardcoded values', async () => {
    const a = await h.registerUser();
    await h.c.db.update(userPreferences).set({ speechRate: 140, wakeWord: 'Selam' }).where(eq(userPreferences.userId, a.userId));
    const me = await h.json<{ locale: string; preferences: { speech_rate: number; wake_word: string } }>('/v1/users/me', { headers: a.headers });
    assert.equal(me.body.locale, 'en-US');
    assert.deepEqual(me.body.preferences, { speech_rate: 140, wake_word: 'Selam' });
    assert.equal(JSON.stringify(me.body).includes('usr-12345'), false);
  });

  test('a suspended user is refused with 403', async () => {
    const a = await h.registerUser();
    await h.c.db.update(users).set({ status: 'suspended' }).where(eq(users.id, a.userId));
    const res = await h.json('/v1/users/me', { headers: a.headers });
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Account suspended' });
  });
});

describe('admin authorization', () => {
  test('unauthenticated admin access → 401', async () => {
    const target = await h.registerUser();
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}`)).status, 401);
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST' })).status, 401);
  });

  test('a normal user session is not an admin credential → 401', async () => {
    const user = await h.registerUser();
    const res = await h.fetch(`/v1/admin/users/${user.userId}`, { headers: user.headers });
    assert.equal(res.status, 401);
  });

  test('an admin without the permission → 403, and the denial is audited', async () => {
    const target = await h.registerUser();
    const reader = await h.createAdmin(['users.read']);
    const res = await h.json(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST', headers: reader.headers });
    assert.equal(res.status, 403);
    const [row] = await auditFor(target.userId);
    assert.equal(row.action, 'users.suspend');
    assert.equal(row.outcome, 'denied');
    assert.equal(row.actorAdminId, reader.adminId);
    assert.deepEqual(row.metadata, { required_permission: 'users.suspend' });
    const [user] = await h.c.db.select().from(users).where(eq(users.id, target.userId));
    assert.equal(user.status, 'active');
  });

  test('an admin with no permissions at all → 403 on every route', async () => {
    const target = await h.registerUser();
    const nobody = await h.createAdmin([]);
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}`, { headers: nobody.headers })).status, 403);
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST', headers: nobody.headers })).status, 403);
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}/reinstate`, { method: 'POST', headers: nobody.headers })).status, 403);
  });

  test('expired, revoked and disabled admin credentials → 401', async () => {
    const target = await h.registerUser();
    const expired = await h.createAdmin(['users.read']);
    await h.c.db.update(adminSessions).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(adminSessions.adminId, expired.adminId));
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}`, { headers: expired.headers })).status, 401);

    const revoked = await h.createAdmin(['users.read']);
    await h.c.adminAuth.revokeAll(revoked.adminId);
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}`, { headers: revoked.headers })).status, 401);

    const disabled = await h.createAdmin(['users.read']);
    await h.c.db.update(adminUsers).set({ status: 'disabled' }).where(eq(adminUsers.id, disabled.adminId));
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}`, { headers: disabled.headers })).status, 401);
  });

  test('user lookup returns the real account and is audited', async () => {
    const target = await h.registerUser();
    const reader = await h.createAdmin(['users.read']);
    const res = await h.json<{ userId: string; status: string }>(`/v1/admin/users/${target.userId}`, {
      headers: { ...reader.headers, 'x-request-id': '11111111-2222-4333-8444-555555555555' },
    });
    assert.equal(res.status, 200);
    zAdminUser.parse(res.body);
    assert.equal(res.body.userId, target.userId);
    assert.equal(res.body.status, 'active');
    const [row] = await auditFor(target.userId);
    assert.equal(row.action, 'users.read');
    assert.equal(row.outcome, 'success');
    assert.equal(row.requestId, '11111111-2222-4333-8444-555555555555');
  });

  test('unknown or malformed target user → 404, audited as not_found', async () => {
    const reader = await h.createAdmin(['users.read', 'users.suspend']);
    for (const id of [randomUUID(), 'usr-12345', "1' OR '1'='1"]) {
      assert.equal((await h.fetch(`/v1/admin/users/${encodeURIComponent(id)}`, { headers: reader.headers })).status, 404);
      assert.equal((await h.fetch(`/v1/admin/users/${encodeURIComponent(id)}/suspend`, { method: 'POST', headers: reader.headers })).status, 404);
    }
    const rows = await h.c.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.actorAdminId, reader.adminId), eq(auditLogs.outcome, 'not_found')));
    assert.equal(rows.length, 6);
  });
});

describe('suspension', () => {
  test('suspend changes state, is audited, and blocks every protected operation', async () => {
    const target = await h.registerUser();
    const agent = await h.createAdmin(['users.suspend', 'users.read']);
    const res = await h.json(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST', headers: agent.headers });
    assert.equal(res.status, 200);
    zSuspendUserResponse.parse(res.body);
    assert.deepEqual(res.body, { status: 'suspended', userId: target.userId });

    const [row] = await h.c.db.select().from(users).where(eq(users.id, target.userId));
    assert.equal(row.status, 'suspended');
    assert.ok(row.suspendedAt);
    const [audit] = await auditFor(target.userId);
    assert.equal(audit.action, 'users.suspend');
    assert.equal(audit.outcome, 'success');
    assert.deepEqual(audit.metadata, { previous_status: 'active', changed: true });

    const blocked: Array<[string, RequestInit]> = [
      ['/v1/users/me', {}],
      ['/v1/app-grants', {}],
      ['/v1/vocabulary', {}],
      ['/v1/billing/entitlement', {}],
      ['/v1/consent/grants/current?scope=audio_retention', {}],
      ['/v1/commands', { method: 'POST', body: JSON.stringify(commandBody()), headers: { 'x-idempotency-key': randomUUID() } }],
      ['/v1/telemetry/events', { method: 'POST', body: JSON.stringify({ outcome: 'done', duration_ms: 1, stage_timings: {} }) }],
    ];
    for (const [path, init] of blocked) {
      const response = await h.fetch(path, {
        ...init,
        headers: { 'content-type': 'application/json', ...target.headers, ...(init.headers as Record<string, string>) },
      });
      assert.equal(response.status, 403, path);
    }
    assert.equal(h.addis.callsTo('/api/v2/stt'), 0, 'a suspended user never reaches the provider');

    // A suspended device cannot mint a fresh session for the same install either.
    const rereg = await h.json('/v1/auth/register-device', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: target.headers.authorization },
      body: JSON.stringify({ install_id: target.installId }),
    });
    assert.equal(rereg.status, 403);
    assert.equal((await h.fetch('/v1/auth/refresh', { method: 'POST', headers: target.headers })).status, 403);
  });

  test('repeated suspension is idempotent and still audited', async () => {
    const target = await h.registerUser();
    const agent = await h.createAdmin(['users.suspend']);
    assert.equal((await h.fetch(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST', headers: agent.headers })).status, 200);
    const again = await h.json(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST', headers: agent.headers });
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, { status: 'suspended', userId: target.userId });
    const rows = await auditFor(target.userId);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].metadata, { previous_status: 'suspended', changed: false });
  });

  test('reinstate restores access', async () => {
    const target = await h.registerUser();
    const agent = await h.createAdmin(['users.suspend']);
    await h.fetch(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST', headers: agent.headers });
    assert.equal((await h.fetch('/v1/users/me', { headers: target.headers })).status, 403);
    const res = await h.json(`/v1/admin/users/${target.userId}/reinstate`, { method: 'POST', headers: agent.headers });
    assert.deepEqual(res.body, { status: 'active', userId: target.userId });
    assert.equal((await h.fetch('/v1/users/me', { headers: target.headers })).status, 200);
  });

  test('suspending an account that is being deleted → 409', async () => {
    const target = await h.registerUser();
    const agent = await h.createAdmin(['users.suspend', 'users.read']);
    await h.fetch('/v1/consent/user-data', { method: 'DELETE', headers: target.headers });
    const res = await h.fetch(`/v1/admin/users/${target.userId}/suspend`, { method: 'POST', headers: agent.headers });
    assert.equal(res.status, 409);
    const view = await h.json<{ status: string }>(`/v1/admin/users/${target.userId}`, { headers: agent.headers });
    assert.equal(view.body.status, 'deleted');
  });
});
