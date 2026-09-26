import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { BillingRepository, SubscriptionRow } from './billing.repository';
import { BillingService } from './billing.service';
import { NoPaymentProvider, type PaymentProvider } from './payment-provider';
import { SubscriptionService, stateOf } from './subscription.service';

const NOW = new Date('2026-09-26T12:00:00Z');
const DAY = 24 * 3600 * 1000;

function row(status: string, renewsInMs: number, quota = 10, used = 0): SubscriptionRow {
  return { id: 'sub-1', userId: 'u1', status, renewsAt: new Date(NOW.getTime() + renewsInMs), commandQuota: quota, commandsUsed: used };
}

function repo(found: SubscriptionRow | null | Error, options: { incrementReturns?: SubscriptionRow | null; delayMs?: number } = {}) {
  const increments: string[] = [];
  const fake = {
    async findLatestSubscription() {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (found instanceof Error) throw found;
      return found;
    },
    async incrementUsage(id: string) {
      increments.push(id);
      return options.incrementReturns === undefined ? found : options.incrementReturns;
    },
  } as unknown as BillingRepository;
  return { fake, increments };
}

function service(mode: 'disabled' | 'enforced', r: BillingRepository, provider: PaymentProvider = new NoPaymentProvider(), timeoutMs = 200) {
  return new BillingService(mode, new SubscriptionService(r, provider, timeoutMs, () => NOW));
}

describe('stateOf', () => {
  test('maps stored statuses to explicit states', () => {
    assert.equal(stateOf(null, NOW), 'NONE');
    assert.equal(stateOf(row('active', DAY), NOW), 'ACTIVE');
    assert.equal(stateOf(row('trialing', DAY), NOW), 'TRIAL');
    assert.equal(stateOf(row('past_due', DAY), NOW), 'PAST_DUE');
    assert.equal(stateOf(row('canceled', DAY), NOW), 'CANCELED');
    assert.equal(stateOf(row('inactive', DAY), NOW), 'INACTIVE');
  });

  test('an active or trial subscription past its renewal date is EXPIRED', () => {
    assert.equal(stateOf(row('active', -1), NOW), 'EXPIRED');
    assert.equal(stateOf(row('trialing', 0), NOW), 'EXPIRED');
  });
});

describe('BillingService (enforced)', () => {
  test('active with quota → allowed and counted once', async () => {
    const { fake, increments } = repo(row('active', DAY));
    assert.deepEqual(await service('enforced', fake).checkCanRunCommand('u1'), { allowed: true, state: 'ACTIVE' });
    assert.deepEqual(increments, ['sub-1']);
  });

  for (const [status, renews] of [['active', -DAY], ['canceled', DAY], ['past_due', DAY], ['inactive', DAY]] as const) {
    test(`${status}${renews < 0 ? ' (expired)' : ''} → refused with ERR_BILLING, nothing counted`, async () => {
      const { fake, increments } = repo(row(status, renews));
      const gate = await service('enforced', fake).checkCanRunCommand('u1');
      assert.equal(gate.allowed, false);
      assert.equal(gate.allowed === false && gate.reason, 'inactive');
      assert.deepEqual(increments, []);
    });
  }

  test('quota used up, or lost to a concurrent command → refused as quota', async () => {
    assert.equal((await service('enforced', repo(row('active', DAY, 5, 5)).fake).checkCanRunCommand('u1') as { reason: string }).reason, 'quota');
    const raced = repo(row('active', DAY, 5, 4), { incrementReturns: null });
    assert.equal((await service('enforced', raced.fake).checkCanRunCommand('u1') as { reason: string }).reason, 'quota');
  });

  test('no subscription and no provider → refused', async () => {
    const gate = await service('enforced', repo(null).fake).checkCanRunCommand('u1');
    assert.deepEqual(gate, { allowed: false, reason: 'inactive', speak_code: 'ERR_BILLING', state: 'NONE' });
  });

  test('database error → UNKNOWN → refused as unverified, never allowed', async () => {
    const gate = await service('enforced', repo(new Error('db down')).fake).checkCanRunCommand('u1');
    assert.deepEqual(gate, { allowed: false, reason: 'unverified', state: 'UNKNOWN' });
  });

  test('a check that exceeds its timeout → UNKNOWN → refused', async () => {
    const gate = await service('enforced', repo(row('active', DAY), { delayMs: 300 }).fake, undefined, 50).checkCanRunCommand('u1');
    assert.equal(gate.allowed === false && gate.reason, 'unverified');
  });

  test('provider unavailable → UNKNOWN → refused', async () => {
    const down: PaymentProvider = { name: 'down', fetchSubscription: async () => Promise.reject(new Error('503')) };
    const gate = await service('enforced', repo(null).fake, down).checkCanRunCommand('u1');
    assert.deepEqual(gate, { allowed: false, reason: 'unverified', state: 'UNKNOWN' });
  });

  test('an active entitlement known only to the provider is honoured', async () => {
    const provider: PaymentProvider = {
      name: 'p',
      fetchSubscription: async () => ({ status: 'active', renewsAt: new Date(NOW.getTime() + DAY), commandQuota: 100 }),
    };
    assert.deepEqual(await service('enforced', repo(null).fake, provider).checkCanRunCommand('u1'), { allowed: true, state: 'ACTIVE' });
  });
});

describe('BillingService (disabled)', () => {
  test('commands are not gated and nothing is read or counted', async () => {
    const { fake, increments } = repo(new Error('must not be called'));
    assert.deepEqual(await service('disabled', fake).checkCanRunCommand('u1'), { allowed: true, state: 'NOT_ENFORCED' });
    assert.deepEqual(increments, []);
  });
});
