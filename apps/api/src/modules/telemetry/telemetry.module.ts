import { Router, Request, Response } from 'express';
import { CommandEventSchema, emit } from './telemetry.service';

export const telemetryModule = Router();

const TELEMETRY_BODY_KEYS = new Set([
  'outcome',
  'duration_ms',
  'stage_timings',
  'confidence',
  'request_id',
]);

telemetryModule.post('/v1/telemetry/events', (req: Request, res: Response) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (!TELEMETRY_BODY_KEYS.has(key)) {
      return res.status(400).json({ error: 'Invalid request' });
    }
  }
  const parsed = CommandEventSchema.safeParse({
    outcome: body.outcome,
    duration_ms: body.duration_ms,
    stage_timings: body.stage_timings,
    confidence: body.confidence,
    request_id: body.request_id ?? req.requestId,
    user_id: req.userId,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  emit(parsed.data);
  return res.status(202).json({ status: 'buffered' });
});
