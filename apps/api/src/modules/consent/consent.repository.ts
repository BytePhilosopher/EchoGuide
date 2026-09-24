import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../shared/database/client';
import { consentGrants, users } from '../../shared/database/schema';

export type ConsentGrantRow = {
  id: string;
  userId: string;
  scope: string;
  granted: boolean;
  createdAt: Date;
};

export async function insertGrant(
  userId: string,
  scope: string,
  granted: boolean,
): Promise<ConsentGrantRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .insert(consentGrants)
    .values({ userId, scope, granted })
    .returning();
  return rows[0] ?? null;
}

export async function findLatestGrant(userId: string, scope: string): Promise<ConsentGrantRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(consentGrants)
    .where(and(eq(consentGrants.userId, userId), eq(consentGrants.scope, scope)))
    .orderBy(desc(consentGrants.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteUserCascade(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
  return rows.length > 0;
}
