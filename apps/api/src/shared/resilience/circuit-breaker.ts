/**
 * Consecutive-failure circuit breaker, exactly as the failure design specifies: open after N
 * consecutive failures, fail fast while open, and after the reset period let a single trial call
 * through (half-open). Its outcome closes or re-opens the breaker; every other caller keeps
 * failing fast until then, so recovery never becomes a request storm.
 *
 * Written here rather than taken from a library because the common Node breaker (opossum) trips
 * on a rolling error percentage and does not guarantee a single half-open trial, which is not the
 * documented policy. The mobile pipeline's CircuitBreaker.kt follows the same model.
 */
export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitOpenError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('circuit_open');
    this.name = 'CircuitOpenError';
  }
}

export type BreakerOptions = {
  failureThreshold: number;
  resetMs: number;
  now?: () => number;
  onStateChange?: (from: BreakerState, to: BreakerState) => void;
};

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt = 0;
  private trialInFlight = false;
  private readonly now: () => number;

  constructor(private readonly options: BreakerOptions) {
    this.now = options.now ?? Date.now;
  }

  state(): BreakerState {
    if (this.consecutiveFailures < this.options.failureThreshold) return 'CLOSED';
    return this.now() - this.openedAt >= this.options.resetMs ? 'HALF_OPEN' : 'OPEN';
  }

  /**
   * Runs `call` through the breaker. `isFailure` decides which errors count: a provider that
   * rejects one bad input is not an outage, a timeout or a 5xx is.
   */
  async execute<T>(call: () => Promise<T>, isFailure: (error: unknown) => boolean = () => true): Promise<T> {
    const state = this.state();
    if (state === 'OPEN') throw new CircuitOpenError(this.retryAfterMs());
    const isTrial = state === 'HALF_OPEN';
    if (isTrial) {
      if (this.trialInFlight) throw new CircuitOpenError(this.retryAfterMs());
      this.trialInFlight = true;
    }
    try {
      const result = await call();
      this.onSuccess();
      return result;
    } catch (error) {
      if (isFailure(error)) this.onFailure(isTrial);
      else if (isTrial) this.onSuccess();
      throw error;
    } finally {
      if (isTrial) this.trialInFlight = false;
    }
  }

  /** Forces the breaker closed. For operators and tests; normal recovery goes through half-open. */
  reset(): void {
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    this.trialInFlight = false;
  }

  private retryAfterMs(): number {
    return Math.max(0, this.options.resetMs - (this.now() - this.openedAt));
  }

  private onSuccess(): void {
    const before = this.state();
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    if (before !== 'CLOSED') this.options.onStateChange?.(before, 'CLOSED');
  }

  private onFailure(wasTrial: boolean): void {
    const before = this.state();
    this.consecutiveFailures += 1;
    if (wasTrial || this.consecutiveFailures >= this.options.failureThreshold) {
      this.consecutiveFailures = Math.max(this.consecutiveFailures, this.options.failureThreshold);
      this.openedAt = this.now();
    }
    const after = this.state();
    if (before !== after) this.options.onStateChange?.(before, after);
  }
}
