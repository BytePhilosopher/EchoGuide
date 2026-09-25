import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../shared/database/client';
import { appGrants } from '../../shared/database/schema';

export type AppGrantRow = {
  id: string;
  userId: string;
  packageName: string;
  granted: boolean;
  createdAt: Date;
};

export async function insertAppGrant(
  userId: string,
  packageName: string,
  granted: boolean,
): Promise<AppGrantRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db.insert(appGrants).values({ userId, packageName, granted }).returning();
  return rows[0] ?? null;
}

export async function findLatestAppGrant(userId: string, packageName: string): Promise<AppGrantRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(appGrants)
    .where(and(eq(appGrants.userId, userId), eq(appGrants.packageName, packageName)))
    .orderBy(desc(appGrants.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listLatestAppGrants(userId: string): Promise<AppGrantRow[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .selectDistinctOn([appGrants.packageName])
    .from(appGrants)
    .where(eq(appGrants.userId, userId))
    .orderBy(appGrants.packageName, desc(appGrants.createdAt));
}
