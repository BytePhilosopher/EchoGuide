import { randomUUID } from 'node:crypto';

/**
 * Post-deploy smoke check against a running API: `SMOKE_BASE_URL=https://… npm run smoke`.
 * Registers a throwaway device, exercises the authenticated path, then deletes the account it
 * created. Makes no provider calls.
 */
type Check = { name: string; ok: boolean; detail: string };

const base = (process.env.SMOKE_BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  const health = await call('/health');
  check('health', health.status === 200 && health.body.status === 'ok', `HTTP ${health.status}`);

  const ready = await call('/ready');
  check('ready', ready.status === 200, `HTTP ${ready.status} ${JSON.stringify(ready.body)}`);

  const phrases = await call('/v1/phrases?language=en-US');
  check('phrases', phrases.status === 200 && typeof phrases.body.phrases === 'object', `HTTP ${phrases.status}`);

  const unauth = await call('/v1/users/me');
  check('users/me requires a session', unauth.status === 401, `HTTP ${unauth.status}`);

  const installId = `smoke-${randomUUID()}`;
  const reg = await call('/v1/auth/register-device', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ install_id: installId, model: 'smoke-check', locale: 'en-US' }),
  });
  const token = typeof reg.body.session_token === 'string' ? reg.body.session_token : '';
  check('register-device issues a session', reg.status === 200 && token.startsWith('egs_'), `HTTP ${reg.status}`);

  if (token) {
    const headers = { authorization: `Bearer ${token}`, 'x-install-id': installId };
    const me = await call('/v1/users/me', { headers });
    check('users/me with the session', me.status === 200 && typeof me.body.user_id === 'string', `HTTP ${me.status}`);

    const hijack = await call('/v1/auth/register-device', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ install_id: installId }),
    });
    check('install id cannot be re-registered without its session', hijack.status === 409, `HTTP ${hijack.status}`);

    const telemetry = await call('/v1/telemetry/events', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ outcome: 'done', duration_ms: 1, stage_timings: {} }),
    });
    check('telemetry accepted', telemetry.status === 202, `HTTP ${telemetry.status}`);

    const deletion = await call('/v1/consent/user-data', { method: 'DELETE', headers });
    check('smoke account deletion queued', deletion.status === 202, `HTTP ${deletion.status}`);
  }

  for (const c of checks) console.log(JSON.stringify({ check: c.name, ok: c.ok, detail: c.detail }));
  if (checks.some((c) => !c.ok)) process.exit(1);
  console.log(JSON.stringify({ event: 'smoke.passed', count: checks.length, base }));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'smoke.failed', error: error instanceof Error ? error.message : 'unknown' }));
  process.exit(1);
});
