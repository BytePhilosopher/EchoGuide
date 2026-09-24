import { createApp } from './app';

type Check = { name: string; ok: boolean; detail: string };

async function request(
  base: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${base}${path}`, init);
  return { status: res.status, body: await res.text() };
}

function parse(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind smoke server');
  }
  const base = `http://127.0.0.1:${address.port}`;
  const audio = Buffer.alloc(800, 1).toString('base64');
  const checks: Check[] = [];

  try {
    const health = await request(base, '/health');
    const healthJson = parse(health.body);
    checks.push({
      name: 'health',
      ok: health.status === 200 && healthJson.status === 'ok',
      detail: `${health.status} ${health.body}`,
    });

    const phrases = await request(base, '/v1/phrases?language=en-US');
    const phrasesJson = parse(phrases.body);
    const phraseMap = phrasesJson.phrases as Record<string, string> | undefined;
    checks.push({
      name: 'phrases en-US',
      ok:
        phrases.status === 200 &&
        Boolean(phraseMap?.ACK) &&
        Boolean(phraseMap?.ERR_BILLING) &&
        Boolean(phraseMap?.RETRY),
      detail: `${phrases.status} ${phrases.body.slice(0, 180)}`,
    });

    const badLang = await request(base, '/v1/phrases?language=xx');
    checks.push({
      name: 'phrases invalid language',
      ok: badLang.status === 400,
      detail: `HTTP ${badLang.status}`,
    });

    const command = await request(base, '/v1/commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': '11111111-1111-4111-8111-111111111111',
        'X-Install-ID': 'missing-device',
        'X-Request-ID': '33333333-3333-4333-8333-333333333333',
      },
      body: JSON.stringify({
        audio_base64: audio,
        duration_ms: 800,
        language: 'am-ET',
        screen_context: { current_package: 'com.whatsapp', view_tree_summary: 'send' },
      }),
    });
    const commandJson = parse(command.body);
    checks.push({
      name: 'command fail-open',
      ok: command.status === 200 && commandJson.status === 'ACCEPTED' && commandJson.speak_code === 'ACK',
      detail: `${command.status} ${command.body}`,
    });

    const missing = await request(base, '/v1/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    checks.push({
      name: 'command missing headers',
      ok: missing.status === 400,
      detail: `HTTP ${missing.status}`,
    });

    const telemetry = await request(base, '/v1/telemetry/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: 'done',
        duration_ms: 1200,
        stage_timings: { stt_ms: 200 },
      }),
    });
    checks.push({
      name: 'telemetry buffer',
      ok: telemetry.status === 202,
      detail: `HTTP ${telemetry.status} ${telemetry.body}`,
    });

    const transcript = await request(base, '/v1/telemetry/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: 'done',
        duration_ms: 1,
        stage_timings: {},
        transcript: 'hello',
      }),
    });
    checks.push({
      name: 'telemetry reject transcript',
      ok: transcript.status === 400,
      detail: `HTTP ${transcript.status}`,
    });

    const consent = await request(base, '/v1/consent/grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'audio_retention', granted: true }),
    });
    checks.push({
      name: 'consent unauthorized without user',
      ok: consent.status === 401,
      detail: `HTTP ${consent.status}`,
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  for (const check of checks) {
    console.log(JSON.stringify({ check: check.name, ok: check.ok, detail: check.detail }));
  }
  if (checks.some((check) => !check.ok)) {
    process.exit(1);
  }
  console.log(JSON.stringify({ event: 'smoke.passed', count: checks.length }));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'smoke.failed', error: error instanceof Error ? error.message : 'unknown' }));
  process.exit(1);
});
