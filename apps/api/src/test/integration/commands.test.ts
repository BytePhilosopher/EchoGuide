import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { zCommandResponse, zEntitlement } from '@echoguide/openapi';
import { subscriptions } from '../../shared/database/schema';
import type { PaymentProvider } from '../../modules/billing/payment-provider';
import { addisFixture } from '../fixtures/addis';
import { commandBody, plannerReply, startHarness, type Harness, type TestUser } from '../harness';

const TAP = { action_type: 'TAP', target_node_id: 'n1', payload: null, is_destructive: false };
const WHATSAPP_PLAN = { package_name: 'com.whatsapp', requires_user_confirmation: false, steps: [TAP] };

async function grant(h: Harness, user: TestUser, packageName = 'com.whatsapp') {
  const res = await h.fetch('/v1/app-grants', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...user.headers },
    body: JSON.stringify({ package_name: packageName, granted: true }),
  });
  assert.equal(res.status, 200);
}

function post(h: Harness, user: TestUser, init: { key?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return h.json<Record<string, unknown>>('/v1/commands', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': init.key ?? randomUUID(),
      ...user.headers,
      ...init.headers,
    },
    body: JSON.stringify(init.body ?? commandBody()),
  });
}

describe('command pipeline', () => {
  let h: Harness;
  let user: TestUser;
  before(async () => {
    h = await startHarness({ env: { ADDIS_BREAKER_RESET_MS: '400' } });
  });
  after(async () => {
    await h.close();
  });
  beforeEach(async () => {
    h.addis.reset();
    h.c.addis.breaker.reset();
    user = await h.registerUser();
    await grant(h, user);
    h.addis.plan = plannerReply(WHATSAPP_PLAN);
  });

  test('a confident transcript and a valid plan for a granted app is ACCEPTED', async () => {
    h.addis.stt = () => ({ body: addisFixture('stt-with-confidence') });
    const res = await post(h, user);
    assert.equal(res.status, 200);
    zCommandResponse.parse(res.body);
    assert.equal(res.body.status, 'ACCEPTED');
    assert.equal(res.body.speak_code, 'ACK');
    assert.equal((res.body.action_plan as { package_name: string }).package_name, 'com.whatsapp');
  });

  test('derived confidence from Whisper-style segments above the floor is ACCEPTED', async () => {
    h.addis.stt = () => ({ body: addisFixture('stt-segments-whisper') });
    const res = await post(h, user);
    assert.equal(res.body.status, 'ACCEPTED');
  });

  test('a provider score below the floor asks again without spending a planning call', async () => {
    h.addis.stt = () => ({ body: { data: { transcription: 'open chats' }, confidence: 0.31 } });
    const res = await post(h, user);
    assert.equal(res.body.status, 'REPROMPT');
    assert.equal(res.body.speak_code, 'RETRY');
    assert.equal(res.body.reprompt_reason, 'Low confidence speech transcription');
    assert.equal(h.addis.callsTo('/api/v1/chat_generate'), 0);
  });

  for (const [fixture, reason] of [
    ['stt-low-logprob', 'Low confidence speech transcription'],
    ['stt-no-speech', 'No speech detected'],
    ['stt-repetition', 'Transcription failed a repetition check'],
  ] as const) {
    test(`${fixture} → REPROMPT (${reason})`, async () => {
      h.addis.stt = () => ({ body: addisFixture(fixture) });
      const res = await post(h, user);
      assert.equal(res.body.status, 'REPROMPT');
      assert.equal(res.body.reprompt_reason, reason);
      assert.equal(h.addis.callsTo('/api/v1/chat_generate'), 0);
    });
  }

  test('missing confidence is not treated as 0: the plan comes back, but must be confirmed first', async () => {
    h.addis.stt = () => ({ body: addisFixture('stt-transcript-only') });
    const res = await post(h, user);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'CONFIRMATION_REQUIRED');
    assert.equal(res.body.speak_code, 'CONFIRM');
    assert.equal((res.body.action_plan as { requires_user_confirmation: boolean }).requires_user_confirmation, true);
    assert.ok(h.logs.some((line) => line.includes('"event":"addis.confidence_unavailable"')));
  });

  test('an out-of-range confidence is a schema mismatch, treated as unavailable rather than rescaled', async () => {
    h.addis.stt = () => ({ body: addisFixture('stt-confidence-out-of-range') });
    const res = await post(h, user);
    assert.equal(res.body.status, 'CONFIRMATION_REQUIRED');
    const mismatch = h.logs.find((line) => line.includes('"event":"addis.schema_mismatch"') && line.includes('confidence'));
    assert.ok(mismatch);
  });

  test('a malformed provider response → 502, logged by field name only', async () => {
    h.addis.stt = () => ({ body: addisFixture('stt-malformed') });
    const res = await post(h, user);
    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { error: 'Voice service returned an unexpected response' });
    const line = h.logs.find((l) => l.includes('"event":"addis.schema_mismatch"') && l.includes('data.transcription'));
    assert.ok(line);
    assert.equal(line.includes('open chats'), false);
  });

  test('a planner reply that is not JSON is REJECTED, never executed', async () => {
    h.addis.stt = () => ({ body: addisFixture('stt-with-confidence') });
    h.addis.plan = () => ({ body: addisFixture('plan-not-json') });
    const res = await post(h, user);
    assert.equal(res.body.status, 'REJECTED');
    assert.equal(res.body.reprompt_reason, 'Plan failed schema validation');
  });

  test('a destructive step forces confirmation', async () => {
    h.addis.plan = plannerReply({ ...WHATSAPP_PLAN, steps: [{ ...TAP, is_destructive: true }] });
    const res = await post(h, user);
    assert.equal(res.body.status, 'CONFIRMATION_REQUIRED');
  });

  test('a plan for an app the user has not granted is REJECTED before reaching the phone', async () => {
    h.addis.plan = plannerReply({ ...WHATSAPP_PLAN, package_name: 'com.chase.mobile' });
    const res = await post(h, user);
    assert.equal(res.body.status, 'REJECTED');
    assert.equal(res.body.reprompt_reason, 'App not authorized for voice control');
    assert.equal(res.body.action_plan, undefined);
  });

  test('a destructive plan for an ungranted app is REJECTED, not sent for confirmation', async () => {
    h.addis.plan = plannerReply({ package_name: 'com.chase.mobile', requires_user_confirmation: true, steps: [{ ...TAP, is_destructive: true }] });
    const res = await post(h, user);
    assert.equal(res.body.status, 'REJECTED');
    assert.equal(res.body.reprompt_reason, 'App not authorized for voice control');
    assert.equal(res.body.action_plan, undefined);
  });

  test("another user's grant does not authorise this user's plan", async () => {
    const other = await h.registerUser();
    await grant(h, other, 'com.chase.mobile');
    h.addis.plan = plannerReply({ ...WHATSAPP_PLAN, package_name: 'com.chase.mobile' });
    const res = await post(h, user);
    assert.equal(res.body.status, 'REJECTED');
  });

  test('a plan with an action outside the allowlist fails schema validation', async () => {
    h.addis.plan = plannerReply({ ...WHATSAPP_PLAN, steps: [{ ...TAP, action_type: 'LAUNCH_APP' }] });
    const res = await post(h, user);
    assert.equal(res.body.reprompt_reason, 'Plan failed schema validation');
  });

  test('an empty plan is REJECTED with speech rather than accepted as a silent no-op', async () => {
    h.addis.plan = plannerReply({ steps: [] });
    const res = await post(h, user);
    assert.equal(res.body.status, 'REJECTED');
    assert.equal(res.body.speak_code, 'ERR_REJECTED');
  });

  test('provider 5xx → 503 with Retry-After and no provider detail', async () => {
    h.addis.stt = () => ({ status: 500, body: { detail: 'internal vendor stack trace' } });
    const res = await post(h, user);
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: 'Voice service unavailable' });
    assert.ok(res.headers.get('retry-after'));
  });

  test('provider timeout → 504', async () => {
    h.addis.stt = () => ({ delayMs: 1200, body: addisFixture('stt-with-confidence') });
    const res = await post(h, user);
    assert.equal(res.status, 504);
    assert.deepEqual(res.body, { error: 'Voice service timed out' });
  });

  test('five consecutive provider failures open the breaker; it fails fast, then recovers through half-open', async () => {
    h.addis.stt = () => ({ status: 503 });
    for (let i = 0; i < 5; i += 1) assert.equal((await post(h, user)).status, 503);
    assert.equal(h.addis.callsTo('/api/v2/stt'), 5);

    const fast = await post(h, user);
    assert.equal(fast.status, 503);
    assert.deepEqual(fast.body, { error: 'Voice service temporarily unavailable' });
    assert.equal(h.addis.callsTo('/api/v2/stt'), 5, 'an open breaker opens no socket');

    await new Promise((resolve) => setTimeout(resolve, 450));
    h.addis.stt = () => ({ body: addisFixture('stt-with-confidence') });
    const trial = await post(h, user);
    assert.equal(trial.body.status, 'ACCEPTED');
    assert.equal(h.c.addis.breaker.state(), 'CLOSED');
  });

  test('a provider 4xx for one bad input does not trip the breaker', async () => {
    h.addis.stt = () => ({ status: 400 });
    for (let i = 0; i < 6; i += 1) await post(h, user);
    assert.equal(h.c.addis.breaker.state(), 'CLOSED');
  });

  test('the request id is echoed and forwarded to the provider with a W3C traceparent', async () => {
    const requestId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const res = await post(h, user, { headers: { 'x-request-id': requestId } });
    assert.equal(res.headers.get('x-request-id'), requestId);
    assert.equal(res.body.command_id, requestId);
    const call = h.addis.calls.find((c) => c.path === '/api/v2/stt');
    assert.equal(call?.headers['x-request-id'], requestId);
    assert.match(String(call?.headers.traceparent), /^00-0f8fad5bd9cb469fa16570867728950e-[0-9a-f]{16}-01$/);
    assert.equal(call?.headers['x-api-key'], 'test-addis-key');
  });

  test('an unsafe client request id is replaced, not logged', async () => {
    const res = await post(h, user, { headers: { 'x-request-id': 'abc","event":"forged' } });
    assert.match(res.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
    assert.equal(h.logs.some((l) => l.includes('forged')), false);
  });

  test('no log line carries the transcript, the audio or the dictated payload', async () => {
    h.addis.stt = () => ({ body: { data: { transcription: 'send secret-phrase-xyz to mum' }, confidence: 0.99 } });
    h.addis.plan = plannerReply({ ...WHATSAPP_PLAN, steps: [{ ...TAP, action_type: 'TEXT_INPUT', payload: 'secret-phrase-xyz' }] });
    await post(h, user);
    const all = h.logs.join('\n');
    assert.equal(all.includes('secret-phrase-xyz'), false);
    assert.equal(all.includes(commandBody().audio_base64.slice(0, 40)), false);
    assert.equal(all.includes(user.token), false);
  });

  describe('request validation', () => {
    test('missing or malformed idempotency key → 400', async () => {
      const missing = await h.json('/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...user.headers },
        body: JSON.stringify(commandBody()),
      });
      assert.equal(missing.status, 400);
      assert.equal((await post(h, user, { key: 'not-a-uuid' })).status, 400);
    });

    test('audio shorter than 0.4 s, longer than 15 s, or not base64 → 400', async () => {
      const short = Buffer.alloc(100).toString('base64');
      const long = Buffer.alloc(16_001 * 32).toString('base64');
      for (const audio of [short, long, '!!!not base64!!!', 'abc']) {
        const res = await post(h, user, { body: commandBody({ audio_base64: audio }) });
        assert.equal(res.status, 400);
      }
      assert.equal(h.addis.callsTo('/api/v2/stt'), 0);
    });

    test('unauthenticated → 401, before any provider call', async () => {
      const res = await h.fetch('/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': randomUUID(), 'x-install-id': user.installId },
        body: JSON.stringify(commandBody()),
      });
      assert.equal(res.status, 401);
      assert.equal(h.addis.callsTo('/api/v2/stt'), 0);
    });
  });

  describe('idempotency', () => {
    test('a repeated key replays the first response without running the pipeline again', async () => {
      const key = randomUUID();
      const first = await post(h, user, { key });
      const second = await post(h, user, { key });
      assert.equal(second.status, 200);
      assert.deepEqual(second.body, first.body);
      assert.equal(second.headers.get('idempotent-replayed'), 'true');
      assert.equal(h.addis.callsTo('/api/v2/stt'), 1);
    });

    test('concurrent duplicates execute once and both receive the same result', async () => {
      h.addis.stt = () => ({ delayMs: 300, body: addisFixture('stt-with-confidence') });
      const key = randomUUID();
      const [a, b, c] = await Promise.all([post(h, user, { key }), post(h, user, { key }), post(h, user, { key })]);
      assert.equal(h.addis.callsTo('/api/v2/stt'), 1);
      assert.deepEqual(b.body, a.body);
      assert.deepEqual(c.body, a.body);
    });

    test('reusing a key with a different request → 422', async () => {
      const key = randomUUID();
      await post(h, user, { key });
      const res = await post(h, user, { key, body: commandBody({ duration_ms: 900 }) });
      assert.equal(res.status, 422);
    });

    test('keys are scoped per user: the same key from another user runs independently', async () => {
      const other = await h.registerUser();
      await grant(h, other);
      const key = randomUUID();
      const mine = await post(h, user, { key });
      const theirs = await post(h, other, { key });
      assert.equal(theirs.headers.get('idempotent-replayed'), null);
      assert.notEqual(theirs.body.command_id, mine.body.command_id);
      assert.equal(h.addis.callsTo('/api/v2/stt'), 2);
    });

    test('a failed attempt is not cached: the retry runs again', async () => {
      const key = randomUUID();
      h.addis.stt = () => ({ status: 500 });
      assert.equal((await post(h, user, { key })).status, 503);
      h.addis.stt = () => ({ body: addisFixture('stt-with-confidence') });
      const retry = await post(h, user, { key });
      assert.equal(retry.body.status, 'ACCEPTED');
      assert.equal(h.addis.callsTo('/api/v2/stt'), 2);
    });
  });
});

describe('unavailable-confidence policy: reprompt', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness({ env: { ADDIS_UNAVAILABLE_CONFIDENCE_POLICY: 'reprompt' } });
  });
  after(async () => {
    await h.close();
  });

  test('with policy=reprompt, a missing score asks again and never plans', async () => {
    const user = await h.registerUser();
    h.addis.stt = () => ({ body: addisFixture('stt-transcript-only') });
    const res = await post(h, user);
    assert.equal(res.body.status, 'REPROMPT');
    assert.equal(res.body.reprompt_reason, 'Transcription confidence unavailable');
    assert.equal(h.addis.callsTo('/api/v1/chat_generate'), 0);
  });
});

describe('billing enforcement', () => {
  let h: Harness;
  let providerMode: 'none' | 'down' | 'slow' = 'none';
  const provider: PaymentProvider = {
    name: 'test-double',
    async fetchSubscription() {
      if (providerMode === 'down') throw new Error('provider unreachable');
      if (providerMode === 'slow') await new Promise((resolve) => setTimeout(resolve, 2000));
      return null;
    },
  };
  before(async () => {
    h = await startHarness({ env: { BILLING_MODE: 'enforced', BILLING_CHECK_TIMEOUT_MS: '300' }, overrides: { paymentProvider: provider } });
  });
  after(async () => {
    await h.close();
  });
  beforeEach(() => {
    providerMode = 'none';
    h.addis.reset();
    h.addis.plan = plannerReply(WHATSAPP_PLAN);
  });

  async function subscribedUser(status: string, renewsInMs: number, quota = 10, used = 0) {
    const user = await h.registerUser();
    await grant(h, user);
    await h.c.db.insert(subscriptions).values({
      userId: user.userId,
      status,
      renewsAt: new Date(Date.now() + renewsInMs),
      commandQuota: quota,
      commandsUsed: used,
    });
    return user;
  }
  const DAY = 24 * 3600 * 1000;

  test('active subscription → allowed, and exactly one command is counted even when replayed', async () => {
    const user = await subscribedUser('active', DAY);
    const key = randomUUID();
    assert.equal((await post(h, user, { key })).body.status, 'ACCEPTED');
    await post(h, user, { key });
    const [row] = await h.c.db.select().from(subscriptions).where(eq(subscriptions.userId, user.userId));
    assert.equal(row.commandsUsed, 1);
    const entitlement = await h.json('/v1/billing/entitlement', { headers: user.headers });
    zEntitlement.parse(entitlement.body);
    assert.equal(entitlement.body.state, 'ACTIVE');
    assert.equal(entitlement.body.enforcement, 'enforced');
  });

  test('trialing subscription → allowed', async () => {
    const user = await subscribedUser('trialing', DAY);
    assert.equal((await post(h, user)).body.status, 'ACCEPTED');
  });

  for (const [label, status, renews] of [
    ['expired (renewal date passed)', 'active', -DAY],
    ['canceled', 'canceled', DAY],
    ['past due', 'past_due', DAY],
    ['inactive', 'inactive', DAY],
  ] as const) {
    test(`${label} → REJECTED with the spoken billing warning, before any provider call`, async () => {
      const user = await subscribedUser(status, renews);
      const res = await post(h, user);
      assert.equal(res.body.status, 'REJECTED');
      assert.equal(res.body.speak_code, 'ERR_BILLING');
      assert.equal(h.addis.callsTo('/api/v2/stt'), 0);
    });
  }

  test('no subscription and no provider record → REJECTED', async () => {
    const user = await h.registerUser();
    const res = await post(h, user);
    assert.equal(res.body.status, 'REJECTED');
    assert.equal(res.body.speak_code, 'ERR_BILLING');
  });

  test('quota exhausted → REJECTED', async () => {
    const user = await subscribedUser('active', DAY, 3, 3);
    const res = await post(h, user);
    assert.equal(res.body.reprompt_reason, 'Command quota exhausted');
  });

  test('provider unavailable → unknown → 503, never treated as active', async () => {
    providerMode = 'down';
    const user = await h.registerUser();
    const res = await post(h, user);
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: 'Billing status could not be verified' });
    assert.equal(h.addis.callsTo('/api/v2/stt'), 0);
    const entitlement = await h.json('/v1/billing/entitlement', { headers: user.headers });
    assert.equal(entitlement.body.state, 'UNKNOWN');
  });

  test('billing check that cannot finish in time → unknown → 503', async () => {
    providerMode = 'slow';
    const user = await h.registerUser();
    const res = await post(h, user);
    assert.equal(res.status, 503);
  });
});

describe('billing disabled', () => {
  let h: Harness;
  before(async () => {
    h = await startHarness({ env: { BILLING_MODE: 'disabled' } });
  });
  after(async () => {
    await h.close();
  });

  test('commands run without a subscription, and the entitlement says billing is not enforced', async () => {
    const user = await h.registerUser();
    await grant(h, user);
    h.addis.plan = plannerReply(WHATSAPP_PLAN);
    assert.equal((await post(h, user)).body.status, 'ACCEPTED');
    const entitlement = await h.json('/v1/billing/entitlement', { headers: user.headers });
    assert.equal(entitlement.body.enforcement, 'disabled');
    assert.equal(entitlement.body.state, 'NONE');
  });
});
