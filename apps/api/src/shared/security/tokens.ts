import { createHmac, randomBytes } from 'node:crypto';

/**
 * Opaque bearer tokens. 32 random bytes, base64url, with a prefix per audience so a user token is
 * never accepted where an admin token is expected, and so secret scanners can recognise them.
 * Only an HMAC of the token is stored; a database leak does not yield usable credentials.
 */
export type TokenKind = 'session' | 'admin';

const PREFIX: Record<TokenKind, string> = { session: 'egs_', admin: 'ega_' };
const TOKEN_BYTES = 32;
const BODY_RE = /^[A-Za-z0-9_-]{43}$/;

export function generateToken(kind: TokenKind): string {
  return PREFIX[kind] + randomBytes(TOKEN_BYTES).toString('base64url');
}

export function isWellFormedToken(kind: TokenKind, token: string): boolean {
  const prefix = PREFIX[kind];
  return token.startsWith(prefix) && BODY_RE.test(token.slice(prefix.length));
}

export function hashToken(secret: string, token: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

/**
 * Parses `Authorization: Bearer <token>`. Anything else — another scheme, extra whitespace,
 * a missing or malformed token — yields null, which callers treat as unauthenticated.
 */
export function parseBearer(header: string | undefined, kind: TokenKind): string | null {
  if (!header || header.length > 256) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) return null;
  return isWellFormedToken(kind, match[1]) ? match[1] : null;
}
