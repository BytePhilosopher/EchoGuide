import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../shared/database/client';
import { appGrants } from '../../shared/database/schema';

export type AppGrantRow = {
  id: string;
  userId: string;
  packageName: string;
  granted: boolean;
  createdAt: Date;
};

export class AppGrantsRepository {
  constructor(private readonly db: Database) {}

  async insertAppGrant(userId: string, packageName: string, granted: boolean): Promise<AppGrantRow> {
    const [row] = await this.db.insert(appGrants).values({ userId, packageName, granted }).returning();
    return row;
  }

  findLatestAppGrant = async (userId: string, packageName: string): Promise<AppGrantRow | null> => {
    const rows = await this.db
      .select()
      .from(appGrants)
      .where(and(eq(appGrants.userId, userId), eq(appGrants.packageName, packageName)))
      .orderBy(desc(appGrants.createdAt))
      .limit(1);
    return rows[0] ?? null;
  };

  async listLatestAppGrants(userId: string): Promise<AppGrantRow[]> {
    return this.db
      .selectDistinctOn([appGrants.packageName])
      .from(appGrants)
      .where(eq(appGrants.userId, userId))
      .orderBy(appGrants.packageName, desc(appGrants.createdAt));
  }
}
