import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { zCurrentUser, zRegisterDeviceResponse } from '@echoguide/openapi';
import { devices, sessions, users } from '../../shared/database/schema';
import { hashToken } from '../../shared/security/tokens';
import { startHarness, TEST_TOKEN_SECRET, type Harness } from '../harness';

let h: Harness;
before(async () => {
  h = await startHarness();
});
after(async () => {
  await h.close();
});

const register = (installId: string, init: { token?: string; body?: Record<string, unknown> } = {}) =>
  h.json<{ status: string; session_token: string; expires_in: number; error?: string }>('/v1/auth/register-device', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: JSON.stringify({ install_id: installId, model: 'Pixel 8', locale: 'am-ET', ...init.body }),
  });

describe('registration', () => {
  test('issues an opaque session token that matches the contract', async () => {
    const res = await register(randomUUID());
    assert.equal(res.status, 200);
    zRegisterDeviceResponse.parse(res.body);
    assert.match(res.body.session_token, /^egs_[A-Za-z0-9_-]{43}$/);
    assert.equal(res.body.expires_in, h.c.config.auth.sessionTtlSeconds);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal('install_id' in res.body, false);
  });

  test('stores only a hash of the token, never the token itself', async () => {
    const installId = randomUUID();
    const res = await register(installId);
    const rows = await h.c.db
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .innerJoin(devices, eq(devices.id, sessions.deviceId))
      .where(eq(devices.installId, installId));
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].tokenHash, res.body.session_token);
    assert.equal(rows[0].tokenHash, hashToken(TEST_TOKEN_SECRET, res.body.session_token));
  });

  test('repeated registration without the device session is refused, so an install id cannot be hijacked', async () => {
    const installId = randomUUID();
    const first = await register(installId);
    const attacker = await register(installId);
    assert.equal(attacker.status, 409);
    assert.equal(attacker.body.session_token, undefined);
    // The original session keeps working.
    const me = await h.json('/v1/users/me', { headers: { authorization: `Bearer ${first.body.session_token}`, 'x-install-id': installId } });
    assert.equal(me.status, 200);
  });

  test('repeated registration with a wrong token is refused with the same response as no token', async () => {
    const installId = randomUUID();
    await register(installId);
    const other = await register(randomUUID());
    const res = await register(installId, { token: other.body.session_token });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'Install id is already registered');
  });

  test('repeated registration with the device session rotates it and revokes the old one (no fixation)', async () => {
    const installId = randomUUID();
    const first = await register(installId);
    const second = await register(installId, { token: first.body.session_token });
    assert.equal(second.status, 200);
    assert.notEqual(second.body.session_token, first.body.session_token);
    const old = await h.fetch('/v1/users/me', { headers: { authorization: `Bearer ${first.body.session_token}`, 'x-install-id': installId } });
    assert.equal(old.status, 401);
    const fresh = await h.fetch('/v1/users/me', { headers: { authorization: `Bearer ${second.body.session_token}`, 'x-install-id': installId } });
    assert.equal(fresh.status, 200);
  });

  test('a client-supplied phone hash never links a new install to an existing account', async () => {
    const phoneHash = 'a'.repeat(64);
    const installA = randomUUID();
    const installB = randomUUID();
    const a = await register(installA, { body: { phone_hash: phoneHash } });
    const b = await register(installB, { body: { phone_hash: phoneHash } });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const me = (token: string, installId: string) =>
      h.json<{ user_id: string }>('/v1/users/me', { headers: { authorization: `Bearer ${token}`, 'x-install-id': installId } });
    const idA = (await me(a.body.session_token, installA)).body.user_id;
    const idB = (await me(b.body.session_token, installB)).body.user_id;
    assert.ok(idA && idB);
    assert.notEqual(idA, idB, 'the second install must not be attached to the first account');
    const stored = await h.c.db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.phoneHash, phoneHash));
    assert.equal(stored[0].n, 0, 'unverified phone hashes are not stored as identity');
  });

  test('rejects malformed registration bodies', async () => {
    for (const body of [{ install_id: 'short' }, { install_id: 'has spaces in it but long' }, { install_id: randomUUID(), locale: 'fr-FR' }, {}]) {
      const res = await h.json('/v1/auth/register-device', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('concurrent registrations of one install id create exactly one device', async () => {
    const installId = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => register(installId)));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 4);
    const rows = await h.c.db.select().from(devices).where(eq(devices.installId, installId));
    assert.equal(rows.length, 1);
  });
});

describe('authenticateRequest', () => {
  let user: Awaited<ReturnType<Harness['registerUser']>>;
  beforeEach(async () => {
    user = await h.registerUser();
  });

  test('valid credentials resolve to the registered user', async () => {
    const res = await h.json('/v1/users/me', { headers: user.headers });
    assert.equal(res.status, 200);
    zCurrentUser.parse(res.body);
    assert.equal(res.body.user_id, user.userId);
  });

  test('missing credentials → 401 with a bearer challenge', async () => {
    const res = await h.fetch('/v1/users/me');
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') ?? '', /^Bearer/);
    assert.deepEqual(await res.json(), { error: 'Unauthorized' });
  });

  test('install id alone is not a credential', async () => {
    const res = await h.fetch('/v1/users/me', { headers: { 'x-install-id': user.installId } });
    assert.equal(res.status, 401);
  });

  test('token without its install id → 401', async () => {
    const res = await h.fetch('/v1/users/me', { headers: { authorization: user.headers.authorization } });
    assert.equal(res.status, 401);
  });

  test('token bound to another install id → 401', async () => {
    const other = await h.registerUser();
    const res = await h.fetch('/v1/users/me', { headers: { authorization: user.headers.authorization, 'x-install-id': other.installId } });
    assert.equal(res.status, 401);
  });

  test('well-formed but unknown token → 401', async () => {
    const res = await h.fetch('/v1/users/me', {
      headers: { authorization: `Bearer egs_${'A'.repeat(43)}`, 'x-install-id': user.installId },
    });
    assert.equal(res.status, 401);
  });

  test('malformed authorization headers → 401', async () => {
    const token = user.token;
    const malformed = [
      token,
      `Basic ${token}`,
      `bearer ${token}`,
      `Bearer  ${token}`,
      `Bearer ${token} extra`,
      'Bearer ',
      `Bearer ${token.slice(0, -1)}`,
      `Bearer ${token}=`,
      `Bearer ega_${token.slice(4)}`,
      `Bearer ${'x'.repeat(300)}`,
    ];
    for (const authorization of malformed) {
      const res = await h.fetch('/v1/users/me', { headers: { authorization, 'x-install-id': user.installId } });
      assert.equal(res.status, 401, authorization.slice(0, 40));
    }
  });

  test('expired session → 401', async () => {
    await h.c.db.update(sessions).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(sessions.tokenHash, hashToken(TEST_TOKEN_SECRET, user.token)));
    const res = await h.fetch('/v1/users/me', { headers: user.headers });
    assert.equal(res.status, 401);
  });

  test('revoked session → 401', async () => {
    await h.c.db.update(sessions).set({ revokedAt: sql`now()` }).where(eq(sessions.tokenHash, hashToken(TEST_TOKEN_SECRET, user.token)));
    const res = await h.fetch('/v1/users/me', { headers: user.headers });
    assert.equal(res.status, 401);
  });

  test('an admin token is not accepted as a user session', async () => {
    const admin = await h.createAdmin(['users.read']);
    const res = await h.fetch('/v1/users/me', { headers: { authorization: `Bearer ${admin.token}`, 'x-install-id': user.installId } });
    assert.equal(res.status, 401);
  });
});

describe('refresh and logout', () => {
  test('refresh rotates the token; the old one stops working at once', async () => {
    const user = await h.registerUser();
    const res = await h.json<{ status: string; session_token: string }>('/v1/auth/refresh', { method: 'POST', headers: user.headers });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'refreshed');
    assert.equal((await h.fetch('/v1/users/me', { headers: user.headers })).status, 401);
    const next = { authorization: `Bearer ${res.body.session_token}`, 'x-install-id': user.installId };
    assert.equal((await h.fetch('/v1/users/me', { headers: next })).status, 200);
  });

  test('a token may be refreshed shortly after it expires, but not once revoked', async () => {
    const user = await h.registerUser();
    const hash = hashToken(TEST_TOKEN_SECRET, user.token);
    await h.c.db.update(sessions).set({ expiresAt: sql`now() - interval '1 hour'` }).where(eq(sessions.tokenHash, hash));
    assert.equal((await h.fetch('/v1/auth/refresh', { method: 'POST', headers: user.headers })).status, 200);
    assert.equal((await h.fetch('/v1/auth/refresh', { method: 'POST', headers: user.headers })).status, 401, 'a rotated token cannot be refreshed twice');
  });

  test('a token past the refresh grace period cannot be refreshed', async () => {
    const user = await h.registerUser();
    await h.c.db
      .update(sessions)
      .set({ expiresAt: sql`now() - make_interval(secs => ${h.c.config.auth.refreshGraceSeconds + 60})` })
      .where(eq(sessions.tokenHash, hashToken(TEST_TOKEN_SECRET, user.token)));
    assert.equal((await h.fetch('/v1/auth/refresh', { method: 'POST', headers: user.headers })).status, 401);
  });

  test('concurrent refreshes of one token: exactly one wins', async () => {
    const user = await h.registerUser();
    const results = await Promise.all(Array.from({ length: 4 }, () => h.fetch('/v1/auth/refresh', { method: 'POST', headers: user.headers })));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
  });

  test('logout revokes the session', async () => {
    const user = await h.registerUser();
    assert.equal((await h.fetch('/v1/auth/logout', { method: 'POST', headers: user.headers })).status, 204);
    assert.equal((await h.fetch('/v1/users/me', { headers: user.headers })).status, 401);
    assert.equal((await h.fetch('/v1/auth/logout', { method: 'POST', headers: user.headers })).status, 401);
  });
});
