import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../shared/errors';
import { describeError, logStructured } from '../shared/logger';

type BodyParserError = Error & { type?: string; status?: number };

/** Last middleware. Maps known errors to safe responses; everything else is a generic 500. */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (error instanceof HttpError) {
    for (const [name, value] of Object.entries(error.headers)) res.setHeader(name, value);
    res.status(error.status).json({ error: error.publicMessage });
    return;
  }
  const parserError = error as BodyParserError;
  if (parserError?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  if (parserError?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON' });
    return;
  }
  if (parserError?.type === 'encoding.unsupported' || parserError?.type === 'charset.unsupported') {
    res.status(415).json({ error: 'Unsupported content encoding' });
    return;
  }
  logStructured('http.unhandled_error', { request_id: req.requestId, ...describeError(error) });
  res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
