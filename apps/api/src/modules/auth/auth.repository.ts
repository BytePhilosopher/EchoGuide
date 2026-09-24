import { eq } from 'drizzle-orm';
import { getDb } from '../../shared/database/client';
import { devices } from '../../shared/database/schema';

export async function findUserIdByInstallId(installId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ userId: devices.userId })
    .from(devices)
    .where(eq(devices.installId, installId))
    .limit(1);
  return rows[0]?.userId ?? null;
}
