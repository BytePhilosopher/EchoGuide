import { Router, type Request } from 'express';
import { unauthorized } from '../../shared/errors';
import { asyncHandler } from '../../shared/http';
import { authenticateAdmin, requirePermission, type AdminAuthService, type AdminPrincipal } from './admin.auth';
import type { AdminService } from './admin.service';
import type { AuditService } from './audit.service';

function adminOf(req: Request): AdminPrincipal {
  if (!req.admin) throw unauthorized();
  return req.admin;
}

export function adminModule(deps: { adminAuth: AdminAuthService; admin: AdminService; audit: AuditService }): Router {
  const router = Router();
  const authenticate = authenticateAdmin(deps.adminAuth);
  const actor = (req: Request) => ({ adminId: adminOf(req).adminId, requestId: req.requestId });

  router.get(
    '/v1/admin/users/:userId',
    authenticate,
    requirePermission('users.read', deps.audit, 'users.read'),
    asyncHandler(async (req, res) => {
      res.json(await deps.admin.getUser(actor(req), req.params.userId));
    }),
  );

  router.post(
    '/v1/admin/users/:userId/suspend',
    authenticate,
    requirePermission('users.suspend', deps.audit, 'users.suspend'),
    asyncHandler(async (req, res) => {
      res.json(await deps.admin.setSuspended(actor(req), req.params.userId, true));
    }),
  );

  router.post(
    '/v1/admin/users/:userId/reinstate',
    authenticate,
    requirePermission('users.suspend', deps.audit, 'users.reinstate'),
    asyncHandler(async (req, res) => {
      res.json(await deps.admin.setSuspended(actor(req), req.params.userId, false));
    }),
  );

  return router;
}
