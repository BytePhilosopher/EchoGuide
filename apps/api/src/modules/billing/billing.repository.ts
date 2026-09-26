import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../shared/database/client';
import { subscriptions } from '../../shared/database/schema';

export type SubscriptionRow = typeof subscriptions.$inferSelect;

export class BillingRepository {
  constructor(private readonly db: Database) {}

  async findLatestSubscription(userId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.renewsAt))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Counts one command, atomically and only while quota remains. */
  async incrementUsage(subscriptionId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db
      .update(subscriptions)
      .set({ commandsUsed: sql`${subscriptions.commandsUsed} + 1` })
      .where(and(eq(subscriptions.id, subscriptionId), sql`${subscriptions.commandsUsed} < ${subscriptions.commandQuota}`))
      .returning();
    return rows[0] ?? null;
  }
}
