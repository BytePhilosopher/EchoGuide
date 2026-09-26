# ADR 005: Opaque Device-Bound Sessions over JWT

## Status
Accepted (2026-09-26). Listed as blocking in the architecture decisions table; recorded with its implementation.

## Context
The API originally identified callers by the `X-Install-ID` header alone. Anyone who learned an install id could act as that user, and `register-device` would attach any new install to an existing account whose phone hash matched — a hash of a phone number, which is brute-forceable. The contract already specified an opaque `session_token`, the `sessions` table existed unused, and docs/architecture/security required revocable, device-bound, rotating sessions and a separate admin credential.

## Decision
1. **Opaque tokens, server-side lookup.** 256-bit random tokens (`egs_…` for users, `ega_…` for admins). Only an HMAC-SHA256 under `AUTH_TOKEN_SECRET` is stored (`sessions.token_hash`, `admin_sessions.token_hash`). Revocation is immediate.
2. **Bound to the install id.** Every user request sends `Authorization: Bearer` and `X-Install-ID`; they must match the session's device.
3. **One live session per device; the server alone mints tokens.** Registering or refreshing revokes the device's previous sessions, which rules out session fixation.
4. **Knowing an install id is not proof of owning it.** Re-registering an existing install requires that device's current session. Otherwise the answer is 409 and the client starts a new install id.
5. **Unverified phone hashes never link accounts.** There is no phone verification provider, so `phone_hash` is accepted for compatibility and ignored. Each install is its own account until verified identity exists.
6. **Rotation.** `POST /v1/auth/refresh` rotates the token. A token expired within `AUTH_REFRESH_GRACE_SECONDS` may still be refreshed; a revoked one never can. `POST /v1/auth/logout` revokes.
7. **Admins are separate.** `admin_users`, `admin_permissions` (permission rows, not roles) and `admin_sessions`. Tokens are issued by an operator CLI; there is no interactive admin login yet.

## Consequences
- **Positive:** Install-id impersonation and phone-hash takeover are closed. Revocation, suspension and deletion take effect on the next request.
- **Negative:** Every authenticated request reads Postgres, so Postgres being down now means 503 (the failure table previously had commands continuing). Devices registered before this change hold no token: their first registration gets 409, they rotate to a new install id and start a fresh account. Suspension is per account and can be evaded by reinstalling until verified identity exists. Rotating `AUTH_TOKEN_SECRET` signs every device out.
