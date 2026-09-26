import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../shared/database/client';
import { consentGrants } from '../../shared/database/schema';

export type ConsentGrantRow = {
  id: string;
  userId: string;
  scope: string;
  granted: boolean;
  createdAt: Date;
};

export class ConsentRepository {
  constructor(private readonly db: Database) {}

  async insertGrant(userId: string, scope: string, granted: boolean): Promise<ConsentGrantRow> {
    const [row] = await this.db.insert(consentGrants).values({ userId, scope, granted }).returning();
    return row;
  }

  async findLatestGrant(userId: string, scope: string): Promise<ConsentGrantRow | null> {
    const rows = await this.db
      .select()
      .from(consentGrants)
      .where(and(eq(consentGrants.userId, userId), eq(consentGrants.scope, scope)))
      .orderBy(desc(consentGrants.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }
}
