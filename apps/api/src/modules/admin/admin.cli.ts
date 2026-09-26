import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { parseConfig } from '../../shared/config';
import { createDatabase } from '../../shared/database/client';
import { ADMIN_PERMISSIONS, type AdminPermission } from '../../shared/database/enums';
import { adminPermissions, adminUsers } from '../../shared/database/schema';
import { AdminAuthService } from './admin.auth';
import { AuditService } from './audit.service';

/**
 * Operator CLI for admin accounts. There is no interactive admin login yet (no SSO or MFA
 * provider exists in this repository), so credentials are issued here by someone who already has
 * production database access. Every action is audited as actor_type=system.
 *
 *   npm run admin --workspace=@echoguide/api -- create --email a@b.c --name "A B" --permissions users.read,users.suspend
 *   npm run admin --workspace=@echoguide/api -- issue-token --email a@b.c
 *   npm run admin --workspace=@echoguide/api -- revoke --email a@b.c
 *   npm run admin --workspace=@echoguide/api -- disable --email a@b.c
 */

function arg(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const config = parseConfig(process.env);
  const { db, pool } = createDatabase(config.databaseUrl, 1);
  const audit = new AuditService(db);
  const adminAuth = new AdminAuthService(db, config.auth.tokenSecret, config.auth.adminSessionTtlSeconds);
  const email = arg(args, 'email')?.trim().toLowerCase();
  if (!email) fail('--email is required');

  const findAdmin = async () =>
    (await db.select().from(adminUsers).where(eq(sql`lower(${adminUsers.email})`, email)).limit(1))[0];

  try {
    switch (command) {
      case 'create': {
        const name = arg(args, 'name') ?? fail('--name is required');
        const requested = (arg(args, 'permissions') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
        const unknown = requested.filter((p) => !(ADMIN_PERMISSIONS as readonly string[]).includes(p));
        if (unknown.length > 0) fail(`Unknown permissions: ${unknown.join(', ')}. Known: ${ADMIN_PERMISSIONS.join(', ')}`);
        const admin = await db.transaction(async (tx) => {
          const existing = (await tx.select().from(adminUsers).where(eq(sql`lower(${adminUsers.email})`, email)).limit(1))[0];
          const row = existing ?? (await tx.insert(adminUsers).values({ email, displayName: name }).returning())[0];
          await tx.delete(adminPermissions).where(eq(adminPermissions.adminId, row.id));
          if (requested.length > 0) {
            await tx.insert(adminPermissions).values(requested.map((permission) => ({ adminId: row.id, permission: permission as AdminPermission })));
          }
          await audit.record(
            { actorType: 'system', action: 'admin.permissions.set', outcome: 'success', metadata: { admin_id: row.id, permissions: requested.join(',') } },
            tx,
          );
          return row;
        });
        console.log(JSON.stringify({ admin_id: admin.id, email, permissions: requested }));
        break;
      }
      case 'issue-token': {
        const admin = (await findAdmin()) ?? fail('No such admin');
        if (admin.status !== 'active') fail('Admin is disabled');
        const { token, expiresAt } = await adminAuth.issueSession(admin.id);
        await audit.record({ actorType: 'system', action: 'admin.session.issued', outcome: 'success', metadata: { admin_id: admin.id } });
        // Printed once. It is not stored anywhere in recoverable form.
        console.log(JSON.stringify({ admin_id: admin.id, token, expires_at: expiresAt.toISOString() }));
        break;
      }
      case 'revoke': {
        const admin = (await findAdmin()) ?? fail('No such admin');
        const revoked = await adminAuth.revokeAll(admin.id);
        await audit.record({ actorType: 'system', action: 'admin.session.revoked', outcome: 'success', metadata: { admin_id: admin.id, sessions: revoked } });
        console.log(JSON.stringify({ admin_id: admin.id, revoked }));
        break;
      }
      case 'disable': {
        const admin = (await findAdmin()) ?? fail('No such admin');
        await db.update(adminUsers).set({ status: 'disabled', disabledAt: sql`now()` }).where(eq(adminUsers.id, admin.id));
        const revoked = await adminAuth.revokeAll(admin.id);
        await audit.record({ actorType: 'system', action: 'admin.disabled', outcome: 'success', metadata: { admin_id: admin.id, sessions: revoked } });
        console.log(JSON.stringify({ admin_id: admin.id, status: 'disabled' }));
        break;
      }
      default:
        fail('Usage: admin <create|issue-token|revoke|disable> --email <email> [--name <name>] [--permissions a,b]');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'admin command failed');
  process.exit(1);
});
