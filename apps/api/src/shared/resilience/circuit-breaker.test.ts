import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitOpenError, type BreakerState } from './circuit-breaker';

function setup(threshold = 5, resetMs = 30_000) {
  let now = 1_000_000;
  const transitions: Array<[BreakerState, BreakerState]> = [];
  const breaker = new CircuitBreaker({
    failureThreshold: threshold,
    resetMs,
    now: () => now,
    onStateChange: (from, to) => transitions.push([from, to]),
  });
  return { breaker, transitions, advance: (ms: number) => (now += ms) };
}

const ok = () => Promise.resolve('ok');
const boom = () => Promise.reject(new Error('provider down'));

describe('circuit breaker', () => {
  test('passes calls through while closed', async () => {
    const { breaker } = setup();
    assert.equal(await breaker.execute(ok), 'ok');
    assert.equal(breaker.state(), 'CLOSED');
  });

  test('opens after N consecutive failures, not before', async () => {
    const { breaker } = setup(5);
    for (let i = 0; i < 4; i += 1) await assert.rejects(breaker.execute(boom));
    assert.equal(breaker.state(), 'CLOSED');
    await assert.rejects(breaker.execute(boom));
    assert.equal(breaker.state(), 'OPEN');
  });

  test('a success resets the consecutive count', async () => {
    const { breaker } = setup(3);
    await assert.rejects(breaker.execute(boom));
    await assert.rejects(breaker.execute(boom));
    await breaker.execute(ok);
    await assert.rejects(breaker.execute(boom));
    await assert.rejects(breaker.execute(boom));
    assert.equal(breaker.state(), 'CLOSED');
  });

  test('fails fast while open without invoking the call, and reports when to retry', async () => {
    const { breaker, advance } = setup(1, 30_000);
    await assert.rejects(breaker.execute(boom));
    advance(10_000);
    let invoked = false;
    const error = await breaker.execute(async () => {
      invoked = true;
      return 'x';
    }).catch((e: unknown) => e);
    assert.ok(error instanceof CircuitOpenError);
    assert.equal(error.retryAfterMs, 20_000);
    assert.equal(invoked, false);
  });

  test('becomes half-open after the reset period and closes on a successful trial', async () => {
    const { breaker, advance, transitions } = setup(1, 30_000);
    await assert.rejects(breaker.execute(boom));
    advance(30_000);
    assert.equal(breaker.state(), 'HALF_OPEN');
    assert.equal(await breaker.execute(ok), 'ok');
    assert.equal(breaker.state(), 'CLOSED');
    assert.deepEqual(transitions, [
      ['CLOSED', 'OPEN'],
      ['HALF_OPEN', 'CLOSED'],
    ]);
  });

  test('a failed trial re-opens the breaker for a full period', async () => {
    const { breaker, advance } = setup(2, 30_000);
    await assert.rejects(breaker.execute(boom));
    await assert.rejects(breaker.execute(boom));
    advance(30_000);
    await assert.rejects(breaker.execute(boom));
    assert.equal(breaker.state(), 'OPEN');
    advance(29_999);
    assert.equal(breaker.state(), 'OPEN');
    advance(1);
    assert.equal(breaker.state(), 'HALF_OPEN');
  });

  test('half-open lets exactly one trial through; concurrent callers fail fast (no request storm)', async () => {
    const { breaker, advance } = setup(1, 1000);
    await assert.rejects(breaker.execute(boom));
    advance(1000);
    let release!: () => void;
    let invocations = 0;
    const slow = () =>
      new Promise<string>((resolve) => {
        invocations += 1;
        release = () => resolve('ok');
      });
    const trial = breaker.execute(slow);
    const others = await Promise.allSettled(Array.from({ length: 20 }, () => breaker.execute(slow)));
    assert.equal(invocations, 1);
    assert.ok(others.every((r) => r.status === 'rejected' && r.reason instanceof CircuitOpenError));
    release();
    assert.equal(await trial, 'ok');
    assert.equal(breaker.state(), 'CLOSED');
  });

  test('errors the classifier says are not outages do not count', async () => {
    const { breaker } = setup(2);
    const badInput = () => Promise.reject(Object.assign(new Error('bad audio'), { outage: false }));
    for (let i = 0; i < 5; i += 1) {
      await assert.rejects(breaker.execute(badInput, (e) => (e as { outage?: boolean }).outage !== false));
    }
    assert.equal(breaker.state(), 'CLOSED');
  });

  test('a timed-out call counts as a failure', async () => {
    const { breaker } = setup(1);
    const timeout = () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await assert.rejects(breaker.execute(timeout));
    assert.equal(breaker.state(), 'OPEN');
  });
});
