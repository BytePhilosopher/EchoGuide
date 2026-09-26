import { Router } from 'express';
import { zRegisterDeviceRequest } from '@echoguide/openapi';
import { badRequest } from '../../shared/errors';
import { asyncHandler } from '../../shared/http';
import { parseBearer } from '../../shared/security/tokens';
import { authenticateRequest, principalOf } from './auth.middleware';
import type { AuthService } from './auth.service';

export function authModule(auth: AuthService): Router {
  const router = Router();

  router.post(
    '/v1/auth/register-device',
    asyncHandler(async (req, res) => {
      // phone_hash is accepted and deliberately ignored: an unverified hash must not link accounts.
      const parsed = zRegisterDeviceRequest.safeParse(req.body);
      if (!parsed.success) throw badRequest('Invalid device registration');
      const issued = await auth.register({
        installId: parsed.data.install_id,
        model: parsed.data.model ?? 'unknown',
        locale: parsed.data.locale ?? 'am-ET',
        presentedToken: parseBearer(req.header('Authorization'), 'session'),
      });
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ status: 'registered', session_token: issued.session_token, expires_in: issued.expires_in });
    }),
  );

  router.post(
    '/v1/auth/refresh',
    asyncHandler(async (req, res) => {
      const issued = await auth.refresh(parseBearer(req.header('Authorization'), 'session'), req.header('X-Install-ID') || undefined);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ status: 'refreshed', session_token: issued.session_token, expires_in: issued.expires_in });
    }),
  );

  router.post(
    '/v1/auth/logout',
    authenticateRequest(auth),
    asyncHandler(async (req, res) => {
      await auth.logout(principalOf(req));
      res.status(204).end();
    }),
  );

  return router;
}
