import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../shared/http';
import { principalOf } from '../auth/auth.middleware';
import type { UsersService } from './users.service';

/** Mounted behind authenticateRequest. The user is always the principal; no id is ever read from the request. */
export function usersModule(users: UsersService, authenticate: RequestHandler): Router {
  const router = Router();
  router.get(
    '/v1/users/me',
    authenticate,
    asyncHandler(async (req, res) => {
      res.json(await users.getCurrentUser(principalOf(req).userId));
    }),
  );
  return router;
}
