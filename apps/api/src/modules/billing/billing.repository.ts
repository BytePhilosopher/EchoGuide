import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../shared/database/client';
import { subscriptions } from '../../shared/database/schema';

export type SubscriptionRow = {
  id: string;
  userId: string;
  status: string;
  renewsAt: Date;
  commandQuota: number;
  commandsUsed: number;
};

export async function findLatestSubscription(userId: string): Promise<SubscriptionRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.renewsAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function incrementUsage(subscriptionId: string): Promise<SubscriptionRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .update(subscriptions)
    .set({ commandsUsed: sql`${subscriptions.commandsUsed} + 1` })
    .where(
      and(
        eq(subscriptions.id, subscriptionId),
        sql`${subscriptions.commandsUsed} < ${subscriptions.commandQuota}`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}
