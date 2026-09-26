import { Router, type RequestHandler } from 'express';
import { badRequest } from '../../shared/errors';
import { asyncHandler } from '../../shared/http';
import { principalOf } from '../auth/auth.middleware';
import { CommandEventSchema, type TelemetryService } from './telemetry.service';

export function telemetryModule(telemetry: TelemetryService, authenticate: RequestHandler): Router {
  const router = Router();

  router.post(
    '/v1/telemetry/events',
    authenticate,
    asyncHandler(async (req, res) => {
      const body: unknown = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest();
      if ('user_id' in body) throw badRequest();
      const parsed = CommandEventSchema.safeParse({
        request_id: req.requestId,
        ...body,
        // The event belongs to the authenticated user, whatever the body says.
        user_id: principalOf(req).userId,
      });
      if (!parsed.success) throw badRequest();
      telemetry.emit(parsed.data);
      res.status(202).json({ status: 'buffered' });
    }),
  );

  return router;
}
