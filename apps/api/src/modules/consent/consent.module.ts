import { Router, type RequestHandler } from 'express';
import { zConsentGrantRequest, zConsentScope } from '@echoguide/openapi';
import { badRequest, notFound } from '../../shared/errors';
import { asyncHandler, isUuid } from '../../shared/http';
import { principalOf } from '../auth/auth.middleware';
import type { ConsentService } from './consent.service';
import type { DeletionService } from './deletion.service';

// The contract's additionalProperties:false is not emitted by the generator, so it is applied here.
const GrantBody = zConsentGrantRequest.strict();

export function consentModule(deps: {
  consent: ConsentService;
  deletion: DeletionService;
  authenticate: RequestHandler;
  // Deletion may be re-requested while it is pending, so a lost response can be recovered.
  authenticateAllowingPendingDeletion: RequestHandler;
}): Router {
  const router = Router();

  router.post(
    '/v1/consent/grants',
    deps.authenticate,
    asyncHandler(async (req, res) => {
      const body = GrantBody.safeParse(req.body);
      if (!body.success) throw badRequest();
      res.json(await deps.consent.recordGrant(principalOf(req).userId, body.data.scope, body.data.granted));
    }),
  );

  router.get(
    '/v1/consent/grants/current',
    deps.authenticate,
    asyncHandler(async (req, res) => {
      const scope = zConsentScope.safeParse(req.query.scope);
      if (!scope.success) throw badRequest();
      res.json(await deps.consent.getCurrentConsent(principalOf(req).userId, scope.data));
    }),
  );

  router.delete(
    '/v1/consent/user-data',
    deps.authenticateAllowingPendingDeletion,
    asyncHandler(async (req, res) => {
      const job = await deps.deletion.requestDeletion(principalOf(req).userId, req.requestId);
      res.status(202).json({ status: 'deletion_queued', task_id: job.id });
    }),
  );

  // The task id is an unguessable capability: it survives the account (which no longer exists to
  // authenticate as once deletion completes) and reveals nothing but the job's progress.
  router.get(
    '/v1/consent/user-data/jobs/:taskId',
    asyncHandler(async (req, res) => {
      if (!isUuid(req.params.taskId)) throw notFound('No such deletion job');
      const job = await deps.deletion.getJob(req.params.taskId);
      if (!job) throw notFound('No such deletion job');
      res.setHeader('Cache-Control', 'no-store');
      res.json(job);
    }),
  );

  return router;
}
