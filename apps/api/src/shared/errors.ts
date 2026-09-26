/**
 * An error with a status and a message that is safe to return to a client. Anything that is not
 * an HttpError becomes a generic 500; internal detail never reaches the response.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(publicMessage);
    this.name = 'HttpError';
  }
}

export const badRequest = (message = 'Invalid request') => new HttpError(400, message);
export const unauthorized = (message = 'Unauthorized') =>
  new HttpError(401, message, { 'WWW-Authenticate': 'Bearer error="invalid_token"' });
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const serviceUnavailable = (message: string, retryAfterSeconds?: number) =>
  new HttpError(
    503,
    message,
    retryAfterSeconds === undefined ? {} : { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  );
