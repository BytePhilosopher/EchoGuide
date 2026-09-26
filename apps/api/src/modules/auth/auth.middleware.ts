import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../../shared/errors';
import { asyncHandler } from '../../shared/http';
import { parseBearer } from '../../shared/security/tokens';
import type { AuthService, UserPrincipal } from './auth.service';

/**
 * Resolves `Authorization: Bearer <session token>` plus `X-Install-ID` to the authenticated
 * principal and attaches it as `req.principal`. Handlers take the user id from here and nowhere
 * else: never from a path, query or body.
 */
export function authenticateRequest(auth: AuthService, options: { allowPendingDeletion?: boolean } = {}): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const token = parseBearer(req.header('Authorization'), 'session');
    req.principal = await auth.authenticate(token, req.header('X-Install-ID') || undefined, options);
    next();
  });
}

/** The authenticated principal. Throws 401 if the route was mounted without authenticateRequest. */
export function principalOf(req: Request): UserPrincipal {
  if (!req.principal) throw unauthorized();
  return req.principal;
}
