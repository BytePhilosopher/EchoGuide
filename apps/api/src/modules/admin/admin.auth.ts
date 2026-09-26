import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Database } from '../../shared/database/client';
import { adminPermissions, adminSessions, adminUsers } from '../../shared/database/schema';
import type { AdminPermission } from '../../shared/database/enums';
import { forbidden, unauthorized } from '../../shared/errors';
import { asyncHandler, isUuid } from '../../shared/http';
import { generateToken, hashToken, parseBearer } from '../../shared/security/tokens';
import type { AuditService } from './audit.service';

export type AdminPrincipal = {
  kind: 'admin';
  adminId: string;
  sessionId: string;
  permissions: ReadonlySet<AdminPermission>;
};

/**
 * Admin credentials are separate from user sessions: their own table, their own token prefix
 * (`ega_`), and permission rows rather than a boolean. A user session token is never accepted here.
 */
export class AdminAuthService {
  constructor(
    private readonly db: Database,
    private readonly tokenSecret: string,
    private readonly sessionTtlSeconds: number,
  ) {}

  async authenticate(token: string | null): Promise<AdminPrincipal> {
    if (!token) throw unauthorized();
    const rows = await this.db
      .select({
        sessionId: adminSessions.id,
        adminId: adminUsers.id,
        expiresAt: adminSessions.expiresAt,
        revokedAt: adminSessions.revokedAt,
        status: adminUsers.status,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminId))
      .where(eq(adminSessions.tokenHash, hashToken(this.tokenSecret, token)))
      .limit(1);
    const session = rows[0];
    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= Date.now() || session.status !== 'active') {
      throw unauthorized();
    }
    const permissions = await this.db
      .select({ permission: adminPermissions.permission })
      .from(adminPermissions)
      .where(eq(adminPermissions.adminId, session.adminId));
    return {
      kind: 'admin',
      adminId: session.adminId,
      sessionId: session.sessionId,
      permissions: new Set(permissions.map((row) => row.permission as AdminPermission)),
    };
  }

  /** Issues a session for an active admin. Used by the operator CLI; the token is shown once. */
  async issueSession(adminId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken('admin');
    const [row] = await this.db
      .insert(adminSessions)
      .values({
        adminId,
        tokenHash: hashToken(this.tokenSecret, token),
        expiresAt: sql`now() + make_interval(secs => ${this.sessionTtlSeconds})`,
      })
      .returning({ expiresAt: adminSessions.expiresAt });
    return { token, expiresAt: row.expiresAt };
  }

  async revokeAll(adminId: string): Promise<number> {
    const rows = await this.db
      .update(adminSessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(adminSessions.adminId, adminId), isNull(adminSessions.revokedAt)))
      .returning({ id: adminSessions.id });
    return rows.length;
  }
}

export function authenticateAdmin(adminAuth: AdminAuthService): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    req.admin = await adminAuth.authenticate(parseBearer(req.header('Authorization'), 'admin'));
    next();
  });
}

/**
 * Every admin route declares the permission it needs. A missing permission is a 403, and the
 * denial itself is audited: who tried what, against whom.
 */
export function requirePermission(permission: AdminPermission, audit: AuditService, action: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const admin = req.admin;
    if (!admin) {
      next(unauthorized());
      return;
    }
    if (admin.permissions.has(permission)) {
      next();
      return;
    }
    audit
      .record({
        actorType: 'admin',
        actorAdminId: admin.adminId,
        action,
        outcome: 'denied',
        targetUserId: isUuid(req.params.userId) ? req.params.userId : null,
        requestId: req.requestId,
        metadata: { required_permission: permission },
      })
      .then(() => next(forbidden('Missing permission')), next);
  };
}
