import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../shared/database/client';
import { devices, sessions, userPreferences, users } from '../../shared/database/schema';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export type SessionLookup = {
  sessionId: string;
  deviceId: string;
  installId: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userStatus: string;
  userDeletedAt: Date | null;
};

export class AuthRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async findSessionByHash(tokenHash: string, tx: Tx | Database = this.db): Promise<SessionLookup | null> {
    const rows = await tx
      .select({
        sessionId: sessions.id,
        deviceId: devices.id,
        installId: devices.installId,
        userId: users.id,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        userStatus: users.status,
        userDeletedAt: users.deletedAt,
      })
      .from(sessions)
      .innerJoin(devices, eq(devices.id, sessions.deviceId))
      .innerJoin(users, eq(users.id, devices.userId))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    return rows[0] ?? null;
  }

  async lockDeviceByInstallId(tx: Tx, installId: string) {
    const rows = await tx
      .select({ deviceId: devices.id, userId: devices.userId, userStatus: users.status, userDeletedAt: users.deletedAt })
      .from(devices)
      .innerJoin(users, eq(users.id, devices.userId))
      .where(eq(devices.installId, installId))
      .for('update', { of: devices })
      .limit(1);
    return rows[0] ?? null;
  }

  async createUserWithDevice(
    tx: Tx,
    input: { installId: string; model: string; locale: 'am-ET' | 'en-US' },
  ): Promise<{ userId: string; deviceId: string } | null> {
    const [user] = await tx.insert(users).values({ locale: input.locale }).returning({ id: users.id });
    await tx.insert(userPreferences).values({ userId: user.id, language: input.locale });
    const inserted = await tx
      .insert(devices)
      .values({ userId: user.id, installId: input.installId, model: input.model })
      .onConflictDoNothing({ target: devices.installId })
      .returning({ id: devices.id });
    if (!inserted[0]) return null;
    return { userId: user.id, deviceId: inserted[0].id };
  }

  async findActiveDeviceSession(tx: Tx, deviceId: string, tokenHash: string) {
    const rows = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.deviceId, deviceId),
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, sql`now()`),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async revokeDeviceSessions(tx: Tx | Database, deviceId: string): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(sessions.deviceId, deviceId), isNull(sessions.revokedAt)));
  }

  /** Revokes one session if it is still live. Returns false if someone else revoked it first. */
  async revokeSession(sessionId: string, tx: Tx | Database = this.db): Promise<boolean> {
    const rows = await tx
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  async insertSession(tx: Tx, deviceId: string, tokenHash: string, ttlSeconds: number): Promise<void> {
    await tx.insert(sessions).values({
      deviceId,
      tokenHash,
      expiresAt: sql`now() + make_interval(secs => ${ttlSeconds})`,
    });
  }

  async touchDevice(tx: Tx | Database, deviceId: string, model?: string): Promise<void> {
    await tx
      .update(devices)
      .set(model ? { model, lastSeenAt: sql`now()` } : { lastSeenAt: sql`now()` })
      .where(eq(devices.id, deviceId));
  }

  /** Best-effort last-seen update, at most once an hour per device to avoid a write per request. */
  async touchDeviceThrottled(deviceId: string): Promise<void> {
    await this.db
      .update(devices)
      .set({ lastSeenAt: sql`now()` })
      .where(and(eq(devices.id, deviceId), sql`${devices.lastSeenAt} < now() - interval '1 hour'`));
  }
}
