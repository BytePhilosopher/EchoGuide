import { Router, type RequestHandler } from 'express';
import { zAppGrantRequest } from '@echoguide/openapi';
import { badRequest } from '../../shared/errors';
import { asyncHandler } from '../../shared/http';
import { principalOf } from '../auth/auth.middleware';
import type { AppGrantsService } from './app-grants.service';

export function appGrantsModule(grants: AppGrantsService, authenticate: RequestHandler): Router {
  const router = Router();

  router.post(
    '/v1/app-grants',
    authenticate,
    asyncHandler(async (req, res) => {
      const body = zAppGrantRequest.safeParse(req.body);
      if (!body.success) throw badRequest();
      res.json(await grants.recordAppGrant(principalOf(req).userId, body.data.package_name, body.data.granted));
    }),
  );

  router.get(
    '/v1/app-grants',
    authenticate,
    asyncHandler(async (req, res) => {
      res.json({ grants: await grants.listAppGrants(principalOf(req).userId) });
    }),
  );

  return router;
}
