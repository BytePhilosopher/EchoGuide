import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';

const ADDIS_BASE = 'http://addis.test';
process.env.ADDIS_AI_BASE_URL = ADDIS_BASE;
process.env.DATABASE_URL = '';

const realFetch = globalThis.fetch;
let plannerReply: unknown = {};

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(`${ADDIS_BASE}/api/v2/stt`)) {
    return Response.json({ data: { transcription: 'send hello to mum' }, confidence: 0.95 });
  }
  if (url.startsWith(`${ADDIS_BASE}/api/v1/chat_generate`)) {
    return Response.json({ response_text: JSON.stringify(plannerReply) });
  }
  return realFetch(input, init);
};

let server: Server;
let base: string;

before(async () => {
  const { createApp } = await import('../../app/app');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  globalThis.fetch = realFetch;
});

async function postCommand(): Promise<Record<string, unknown>> {
  const res = await realFetch(`${base}/v1/commands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
      'X-Install-ID': 'test-install',
    },
    body: JSON.stringify({
      audio_base64: Buffer.alloc(800, 1).toString('base64'),
      duration_ms: 800,
      language: 'en-US',
      screen_context: { current_package: 'com.chase.mobile', view_tree_summary: 'n1 Send' },
    }),
  });
  assert.equal(res.status, 200);
  return (await res.json()) as Record<string, unknown>;
}

const step = (overrides: Record<string, unknown> = {}) => ({
  action_type: 'TAP',
  target_node_id: 'n1',
  is_destructive: false,
  ...overrides,
});

test('schema-valid plan for an app with no grant is rejected before reaching the phone', async () => {
  plannerReply = { package_name: 'com.chase.mobile', requires_user_confirmation: false, steps: [step()] };
  const body = await postCommand();
  assert.equal(body.status, 'REJECTED');
  assert.equal(body.reprompt_reason, 'App not authorized for voice control');
  assert.equal(body.speak_code, 'ERR_REJECTED');
  assert.equal(body.action_plan, undefined);
});

test('destructive plan for an ungranted app is rejected, not sent for confirmation', async () => {
  plannerReply = {
    package_name: 'com.chase.mobile',
    requires_user_confirmation: true,
    steps: [step({ is_destructive: true })],
  };
  const body = await postCommand();
  assert.equal(body.status, 'REJECTED');
  assert.equal(body.reprompt_reason, 'App not authorized for voice control');
  assert.equal(body.action_plan, undefined);
});

test('malformed plan is rejected by schema validation before the allowlist', async () => {
  plannerReply = {
    package_name: 'com.chase.mobile',
    requires_user_confirmation: false,
    steps: [step({ action_type: 'LAUNCH_APP' })],
  };
  const body = await postCommand();
  assert.equal(body.status, 'REJECTED');
  assert.equal(body.reprompt_reason, 'Plan failed schema validation');
});

test('app-grant endpoints require an identified user', async () => {
  const post = await realFetch(`${base}/v1/app-grants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package_name: 'com.whatsapp', granted: true }),
  });
  assert.equal(post.status, 401);
  const list = await realFetch(`${base}/v1/app-grants`);
  assert.equal(list.status, 401);
});
