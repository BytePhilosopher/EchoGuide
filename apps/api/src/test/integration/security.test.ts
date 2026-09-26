import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { commandBody, startHarness, type Harness } from '../harness';

describe('CORS', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness();
  });
  after(async () => {
    await h.close();
  });

  test('an allowlisted origin gets CORS headers, including on preflight', async () => {
    const res = await h.fetch('/v1/phrases', { headers: { origin: 'http://admin.test' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://admin.test');
    const preflight = await h.fetch('/v1/users/me', {
      method: 'OPTIONS',
      headers: { origin: 'http://admin.test', 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' },
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /Authorization/i);
  });

  test('an unknown origin is refused outright, never answered with a wildcard', async () => {
    for (const origin of ['https://evil.example', 'http://admin.test.evil.example', 'null']) {
      const res = await h.fetch('/v1/phrases', { headers: { origin } });
      assert.equal(res.status, 403, origin);
      assert.equal(res.headers.get('access-control-allow-origin'), null);
    }
    const preflight = await h.fetch('/v1/users/me', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
    assert.equal(preflight.status, 403);
  });

  test('requests without an Origin (the mobile client) are unaffected', async () => {
    const res = await h.fetch('/v1/phrases');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

describe('body limits', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness({ env: { JSON_BODY_LIMIT_BYTES: '2048', COMMAND_BODY_LIMIT_BYTES: '1048576' } });
  });
  after(async () => {
    await h.close();
  });

  test('JSON routes reject bodies over the small JSON limit with 413', async () => {
    const res = await h.json('/v1/auth/register-device', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ install_id: randomUUID(), model: 'x'.repeat(4096) }),
    });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, { error: 'Payload too large' });
  });

  test('the command route accepts a full 15 s utterance, which the JSON limit would refuse', async () => {
    const user = await h.registerUser();
    const res = await h.fetch('/v1/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': randomUUID(), ...user.headers },
      body: JSON.stringify(commandBody({ audio_base64: Buffer.alloc(15_000 * 32, 1).toString('base64'), duration_ms: 15000 })),
    });
    assert.notEqual(res.status, 413);
  });

  test('the command route rejects bodies over the audio limit with 413', async () => {
    const user = await h.registerUser();
    const res = await h.fetch('/v1/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': randomUUID(), ...user.headers },
      body: JSON.stringify(commandBody({ audio_base64: 'A'.repeat(1_100_000) })),
    });
    assert.equal(res.status, 413);
  });

  test('malformed JSON → 400, not a 500 or a hang', async () => {
    const res = await h.json('/v1/auth/register-device', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"install_id":' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Malformed JSON' });
  });

  test('unknown routes → JSON 404', async () => {
    const res = await h.json('/v1/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Not found' });
  });
});

describe('rate limiting', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness({ env: { RATE_LIMIT_AUTH_MAX: '3', RATE_LIMIT_COMMANDS_MAX: '2', RATE_LIMIT_WINDOW_SECONDS: '60' } });
  });
  after(async () => {
    await h.close();
  });

  test('registration is limited per client IP with 429 and Retry-After; counters live in Redis', async () => {
    const statuses: number[] = [];
    let last: Response | null = null;
    for (let i = 0; i < 5; i += 1) {
      last = await h.fetch('/v1/auth/register-device', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ install_id: randomUUID() }),
      });
      statuses.push(last.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    assert.ok(Number(last!.headers.get('retry-after')) >= 1);
    assert.deepEqual(await last!.json(), { error: 'Too many requests' });
    const keys = await h.c.redis.keys(`${h.c.config.redisKeyPrefix}rl:auth:*`);
    assert.equal(keys.length, 1);
    assert.ok((await h.c.redis.pttl(keys[0])) > 0, 'counters expire');
  });

  test('a spoofed X-Forwarded-For does not reset the limit when no proxy is trusted', async () => {
    const res = await h.fetch('/v1/auth/register-device', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ install_id: randomUUID() }),
    });
    assert.equal(res.status, 429);
  });

  test('commands are limited per user, not per connection, and one user does not exhaust another', async () => {
    await h.c.redis.del(...(await h.c.redis.keys(`${h.c.config.redisKeyPrefix}rl:auth:*`)));
    const a = await h.registerUser();
    const b = await h.registerUser();
    const send = (headers: Record<string, string>) =>
      h.fetch('/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': randomUUID(), ...headers },
        body: JSON.stringify(commandBody()),
      });
    // Parallel requests arrive on separate connections; the key is the user, so it does not matter.
    const results = await Promise.all([send(a.headers), send(a.headers), send(a.headers), send(a.headers)]);
    assert.equal(results.filter((r) => r.status === 429).length, 2);
    assert.notEqual((await send(b.headers)).status, 429);
  });

  test('when Redis is unreachable, requests are served (documented degradation) and an alert is logged', async () => {
    const original = h.c.redis.eval.bind(h.c.redis);
    (h.c.redis as unknown as { eval: unknown }).eval = async () => {
      throw new Error('Connection is closed.');
    };
    try {
      const res = await h.fetch('/v1/phrases');
      assert.equal(res.status, 200);
      assert.ok(h.logs.some((l) => l.includes('"event":"rate_limit.unavailable"')));
    } finally {
      (h.c.redis as unknown as { eval: unknown }).eval = original;
    }
  });
});

describe('every protected route requires authentication and rejects bypass attempts', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness();
  });
  after(async () => {
    await h.close();
  });

  const USER_ROUTES: Array<[string, string]> = [
    ['GET', '/v1/users/me'],
    ['POST', '/v1/commands'],
    ['GET', '/v1/app-grants'],
    ['POST', '/v1/app-grants'],
    ['POST', '/v1/consent/grants'],
    ['GET', '/v1/consent/grants/current?scope=audio_retention'],
    ['DELETE', '/v1/consent/user-data'],
    ['POST', '/v1/telemetry/events'],
    ['GET', '/v1/billing/entitlement'],
    ['GET', '/v1/vocabulary'],
    ['POST', '/v1/vocabulary'],
    ['PATCH', `/v1/vocabulary/${randomUUID()}`],
    ['DELETE', `/v1/vocabulary/${randomUUID()}`],
    ['POST', '/v1/auth/logout'],
  ];

  test('no credentials, install id only, or a forged token → 401 on every user route', async () => {
    const victim = await h.registerUser();
    const attempts: Array<Record<string, string>> = [
      {},
      { 'x-install-id': victim.installId },
      { 'x-install-id': victim.installId, authorization: `Bearer egs_${'B'.repeat(43)}` },
      { 'x-install-id': victim.installId, 'x-user-id': victim.userId },
    ];
    for (const [method, path] of USER_ROUTES) {
      for (const headers of attempts) {
        const res = await h.fetch(path, {
          method,
          headers: { 'content-type': 'application/json', 'x-idempotency-key': randomUUID(), ...headers },
          body: method === 'GET' ? undefined : '{}',
        });
        assert.equal(res.status, 401, `${method} ${path} with ${Object.keys(headers).join(',') || 'nothing'}`);
      }
    }
  });

  test('admin routes refuse missing credentials, user tokens, and admins without the permission', async () => {
    const user = await h.registerUser();
    const nobody = await h.createAdmin([]);
    for (const [method, path] of [
      ['GET', `/v1/admin/users/${user.userId}`],
      ['POST', `/v1/admin/users/${user.userId}/suspend`],
      ['POST', `/v1/admin/users/${user.userId}/reinstate`],
    ] as const) {
      assert.equal((await h.fetch(path, { method })).status, 401);
      assert.equal((await h.fetch(path, { method, headers: user.headers })).status, 401);
      assert.equal((await h.fetch(path, { method, headers: nobody.headers })).status, 403);
    }
  });

  test('helmet security headers are set and the framework is not advertised', async () => {
    const res = await h.fetch('/health');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('strict-transport-security'));
  });

  test('readiness reports dependency state without detail', async () => {
    const res = await h.json('/ready');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ready', database: 'ok', redis: 'ok' });
  });
});
