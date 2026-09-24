import { Router, Request, Response } from 'express';
import { getEntitlement } from './billing.service';

export const billingModule = Router();

billingModule.get('/v1/billing/entitlement', async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const entitlement = await getEntitlement(req.userId);
  return res.json(entitlement);
});
