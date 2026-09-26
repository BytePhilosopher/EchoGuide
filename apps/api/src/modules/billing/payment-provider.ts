/**
 * The boundary to a payment provider. None is integrated: the repository names no provider and
 * no pricing exists yet (docs: architecture/performance, "Pricing is incomplete"). A real
 * provider implements this interface and keeps the local `subscriptions` table in sync (for
 * example from webhooks); the command path reads that table, never the provider, so a provider
 * outage cannot add latency to a voice command.
 */
export type ProviderSubscription = {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive';
  renewsAt: Date;
  commandQuota: number;
};

export interface PaymentProvider {
  readonly name: string;
  /** Latest state for a user who has no local subscription row. Throws if the provider is unreachable. */
  fetchSubscription(userId: string): Promise<ProviderSubscription | null>;
}

export class ProviderUnavailableError extends Error {
  constructor(readonly provider: string) {
    super('payment_provider_unavailable');
    this.name = 'ProviderUnavailableError';
  }
}

/** No provider configured. Explicitly reports "no subscription"; never invents one. */
export class NoPaymentProvider implements PaymentProvider {
  readonly name = 'none';

  async fetchSubscription(): Promise<null> {
    return null;
  }
}
