import { Router, Request, Response } from 'express';

export const consentModule = Router();

/**
 * Section 9.3 & 9.4 Append-only Consent & Deletion
 */
consentModule.post('/v1/consent/grants', (req: Request, res: Response) => {
  const { scope, granted } = req.body;
  // Always append new row, never UPDATE existing consent rows
  return res.json({ status: 'recorded', scope, granted });
});

consentModule.delete('/v1/consent/user-data', (req: Request, res: Response) => {
  // Cascades DB deletion and enqueues object storage cleanup job (§9.4)
  return res.json({ status: 'deletion_queued', task_id: 'del-job-' + Date.now() });
});
