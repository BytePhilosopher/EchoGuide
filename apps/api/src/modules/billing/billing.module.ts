import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../shared/http';
import { principalOf } from '../auth/auth.middleware';
import type { BillingService } from './billing.service';

export function billingModule(billing: BillingService, authenticate: RequestHandler): Router {
  const router = Router();
  router.get(
    '/v1/billing/entitlement',
    authenticate,
    asyncHandler(async (req, res) => {
      res.json(await billing.getEntitlement(principalOf(req).userId));
    }),
  );
  return router;
}
