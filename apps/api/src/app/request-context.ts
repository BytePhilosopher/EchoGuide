import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithScope, traceIdFor } from '../shared/context';
import { UUID_RE } from '../shared/http';
import { logStructured } from '../shared/logger';

/**
 * Correlation. The phone generates a UUID request id and sends it as X-Request-ID; it is accepted
 * only if it is a well-formed UUID (anything else could inject into logs), otherwise a random one
 * is generated. The id is echoed in the response, carried by every log line of the request via
 * AsyncLocalStorage, forwarded to Addis AI, and is the command_events primary key.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-ID');
  req.requestId = incoming && UUID_RE.test(incoming) ? incoming.toLowerCase() : randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    logStructured('http.request', {
      request_id: req.requestId,
      method: req.method,
      // The matched route pattern, not the raw URL, so ids and query strings stay out of the line.
      route: req.route ? `${req.baseUrl}${String(req.route.path)}` : 'unmatched',
      status: res.statusCode,
      duration_ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
    });
  });
  runWithScope({ requestId: req.requestId, traceId: traceIdFor(req.requestId) }, next);
}
