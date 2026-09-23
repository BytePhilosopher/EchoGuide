import { Router, Request, Response } from 'express';

export const telemetryModule = Router();

telemetryModule.post('/v1/telemetry/events', (req: Request, res: Response) => {
  const { outcome, duration_ms, stage_timings } = req.body;
  return res.status(202).json({ status: 'buffered' });
});
