import type { BillingRepository, SubscriptionRow } from './billing.repository';
import type { PaymentProvider } from './payment-provider';

export type SubscriptionState = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE' | 'EXPIRED' | 'NONE' | 'UNKNOWN';

export type SubscriptionSnapshot =
  | { state: 'UNKNOWN'; row: null; reason: 'timeout' | 'error' | 'provider_unavailable' }
  | { state: Exclude<SubscriptionState, 'UNKNOWN'>; row: SubscriptionRow | null };

const STATE_BY_STATUS: Record<string, Exclude<SubscriptionState, 'UNKNOWN' | 'NONE' | 'EXPIRED'>> = {
  active: 'ACTIVE',
  trialing: 'TRIAL',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  inactive: 'INACTIVE',
};

/** Maps a stored subscription to an explicit state. A lapsed renewal date is EXPIRED, whatever the status says. */
export function stateOf(row: SubscriptionRow | null, now: Date): Exclude<SubscriptionState, 'UNKNOWN'> {
  if (!row) return 'NONE';
  const state = STATE_BY_STATUS[row.status] ?? 'INACTIVE';
  if ((state === 'ACTIVE' || state === 'TRIAL') && row.renewsAt.getTime() <= now.getTime()) return 'EXPIRED';
  return state;
}

export class SubscriptionService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly provider: PaymentProvider,
    private readonly timeoutMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * The user's subscription state. Anything that prevents a definite answer — a slow or failed
   * database read, an unreachable provider — is UNKNOWN, which callers must never treat as active.
   */
  async snapshot(userId: string): Promise<SubscriptionSnapshot> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<SubscriptionSnapshot>((resolve) => {
      timer = setTimeout(() => resolve({ state: 'UNKNOWN', row: null, reason: 'timeout' }), this.timeoutMs);
    });
    try {
      return await Promise.race([this.read(userId), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async read(userId: string): Promise<SubscriptionSnapshot> {
    let row: SubscriptionRow | null;
    try {
      row = await this.repo.findLatestSubscription(userId);
    } catch {
      return { state: 'UNKNOWN', row: null, reason: 'error' };
    }
    if (row) return { state: stateOf(row, this.now()), row };
    try {
      const remote = await this.provider.fetchSubscription(userId);
      if (!remote) return { state: 'NONE', row: null };
      const synthetic = {
        id: '',
        userId,
        status: remote.status,
        renewsAt: remote.renewsAt,
        commandQuota: remote.commandQuota,
        commandsUsed: 0,
      } satisfies SubscriptionRow;
      return { state: stateOf(synthetic, this.now()), row: null };
    } catch {
      return { state: 'UNKNOWN', row: null, reason: 'provider_unavailable' };
    }
  }

  incrementUsage(subscriptionId: string): Promise<SubscriptionRow | null> {
    return this.repo.incrementUsage(subscriptionId);
  }
}
