import cors from 'cors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Browser origins come from an explicit allowlist (CORS_ORIGINS). The mobile client sends no
 * Origin header and is unaffected. A request that carries an Origin not on the list is refused
 * with 403 rather than served without CORS headers, so a disallowed page gets nothing at all.
 */
export function corsPolicy(allowedOrigins: string[]): RequestHandler[] {
  const allowed = new Set(allowedOrigins);
  const reject: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('Origin');
    if (origin !== undefined && !allowed.has(origin)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    next();
  };
  const headers = cors({
    origin: (origin, callback) => callback(null, origin !== undefined && allowed.has(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Install-ID', 'X-Idempotency-Key', 'X-Request-ID', 'traceparent'],
    exposedHeaders: ['X-Request-ID', 'Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 600,
  });
  return [reject, headers];
}
