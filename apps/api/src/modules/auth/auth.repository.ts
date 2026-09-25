import { eq } from 'drizzle-orm';
import { getDb } from '../../shared/database/client';
import { devices, users } from '../../shared/database/schema';

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

export async function registerDevice(input: {
  installId: string;
  phoneHash: string;
  model: string;
  locale: string;
}): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ userId: devices.userId })
      .from(devices)
      .where(eq(devices.installId, input.installId))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(devices)
        .set({ model: input.model, lastSeenAt: new Date() })
        .where(eq(devices.installId, input.installId));
      return existing[0].userId;
    }

    const existingUser = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneHash, input.phoneHash))
      .limit(1);

    const userId =
      existingUser[0]?.id ??
      (
        await tx
          .insert(users)
          .values({ phoneHash: input.phoneHash, locale: input.locale })
          .returning({ id: users.id })
      )[0].id;

    await tx.insert(devices).values({
      userId,
      installId: input.installId,
      model: input.model,
    });

    return userId;
  });
}
