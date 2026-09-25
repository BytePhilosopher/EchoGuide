import { Router, Request, Response } from 'express';
import { zAppGrantRequest } from '@echoguide/openapi';
import { listAppGrants, recordAppGrant } from './app-grants.service';

export const appGrantsModule = Router();

appGrantsModule.post('/v1/app-grants', async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = zAppGrantRequest.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const recorded = await recordAppGrant(req.userId, body.data.package_name, body.data.granted);
  return res.json(recorded);
});

appGrantsModule.get('/v1/app-grants', async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({ grants: await listAppGrants(req.userId) });
});
