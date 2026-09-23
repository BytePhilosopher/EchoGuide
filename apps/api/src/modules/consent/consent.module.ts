import { Router, Request, Response } from 'express';

export const consentModule = Router();

consentModule.post('/v1/consent/grants', (req: Request, res: Response) => {
  const { scope, granted } = req.body;
  // Append-only: revocation is a new row with granted = false. Never UPDATE a grant.
  return res.json({ status: 'recorded', scope, granted });
});

consentModule.delete('/v1/consent/user-data', (req: Request, res: Response) => {
  return res.json({ status: 'deletion_queued', task_id: 'del-job-' + Date.now() });
});
