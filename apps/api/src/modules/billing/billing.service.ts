import { describeError, logStructured } from '../../shared/logger';
import type { SubscriptionService, SubscriptionState } from './subscription.service';

export const SPEAK_BILLING = 'ERR_BILLING';

export type BillingMode = 'disabled' | 'enforced';

export type Entitlement = {
  enforcement: BillingMode;
  state: SubscriptionState;
  status: string | null;
  renews_at: string | null;
  command_quota: number | null;
  commands_used: number | null;
};

export type CommandGate =
  | { allowed: true; state: SubscriptionState | 'NOT_ENFORCED' }
  | { allowed: false; reason: 'inactive' | 'quota'; speak_code: typeof SPEAK_BILLING; state: SubscriptionState }
  | { allowed: false; reason: 'unverified'; state: 'UNKNOWN' };

/**
 * Command authorisation by subscription.
 *
 * BILLING_MODE=disabled — the product runs without billing (no payment provider exists yet).
 *   Commands are not gated and nothing is counted. This is explicit configuration, not a
 *   fallback, and production refuses to start without it being set.
 * BILLING_MODE=enforced —
 *   ACTIVE, TRIAL (renewal date in the future)  → allowed, one command counted against quota
 *   quota exhausted                             → refused, spoken ERR_BILLING
 *   PAST_DUE, CANCELED, INACTIVE, EXPIRED, NONE → refused, spoken ERR_BILLING (the "spoken warning"
 *                                                  docs/architecture/backend requires)
 *   UNKNOWN (DB slow/failed, provider down)     → refused as unverified; the API answers 503 so the
 *                                                  phone says it cannot reach the service. Unknown
 *                                                  is never treated as active.
 */
export class BillingService {
  constructor(
    private readonly mode: BillingMode,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async getEntitlement(userId: string): Promise<Entitlement> {
    const snapshot = await this.subscriptions.snapshot(userId);
    const row = snapshot.row;
    return {
      enforcement: this.mode,
      state: snapshot.state,
      status: row?.status ?? null,
      renews_at: row?.renewsAt.toISOString() ?? null,
      command_quota: row?.commandQuota ?? null,
      commands_used: row?.commandsUsed ?? null,
    };
  }

  async checkCanRunCommand(userId: string): Promise<CommandGate> {
    if (this.mode === 'disabled') return { allowed: true, state: 'NOT_ENFORCED' };

    const snapshot = await this.subscriptions.snapshot(userId);
    if (snapshot.state === 'UNKNOWN') {
      logStructured('billing.unverified', { reason: snapshot.reason });
      return { allowed: false, reason: 'unverified', state: 'UNKNOWN' };
    }
    if (snapshot.state !== 'ACTIVE' && snapshot.state !== 'TRIAL') {
      return { allowed: false, reason: 'inactive', speak_code: SPEAK_BILLING, state: snapshot.state };
    }
    const row = snapshot.row;
    // An entitlement known only to the provider has no local row to count against yet.
    if (!row) return { allowed: true, state: snapshot.state };
    if (row.commandsUsed >= row.commandQuota) {
      return { allowed: false, reason: 'quota', speak_code: SPEAK_BILLING, state: snapshot.state };
    }
    try {
      const updated = await this.subscriptions.incrementUsage(row.id);
      if (!updated) return { allowed: false, reason: 'quota', speak_code: SPEAK_BILLING, state: snapshot.state };
    } catch (error) {
      logStructured('billing.usage_failed', describeError(error));
      return { allowed: false, reason: 'unverified', state: 'UNKNOWN' };
    }
    return { allowed: true, state: snapshot.state };
  }
}
