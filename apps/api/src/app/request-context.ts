import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { resolveUserIdByInstallId } from '../modules/auth/auth.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-ID');
  req.requestId = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();
  req.installId = req.header('X-Install-ID') || undefined;
  if (!req.installId) {
    next();
    return;
  }
  void resolveUserIdByInstallId(req.installId)
    .then((userId) => {
      req.userId = userId ?? undefined;
      next();
    })
    .catch(() => {
      req.userId = undefined;
      next();
    });
}
