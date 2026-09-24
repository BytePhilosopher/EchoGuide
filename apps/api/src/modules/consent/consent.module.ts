import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getCurrentConsent, recordGrant, requestDeletion } from './consent.service';

export const consentModule = Router();

const GrantBody = z.object({
  scope: z.string().min(1),
  granted: z.boolean(),
});

consentModule.post('/v1/consent/grants', async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = GrantBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const recorded = await recordGrant(req.userId, body.data.scope, body.data.granted);
  return res.json(recorded);
});

consentModule.get('/v1/consent/grants/current', async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
  if (!scope) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  return res.json(await getCurrentConsent(req.userId, scope));
});

consentModule.delete('/v1/consent/user-data', async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json(await requestDeletion(req.userId));
});
