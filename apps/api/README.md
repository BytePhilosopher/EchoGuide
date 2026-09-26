# EchoGuide API

The backend for EchoGuide: device authentication, the voice command pipeline (Addis AI
transcription → confidence gate → planning → validation), consent and data deletion, billing,
vocabulary, telemetry and admin tooling.

Express + TypeScript, organised as a **modular monolith** (ADR 002). **Postgres** is the source of
truth; **Redis** holds rate limits, idempotency records, the telemetry buffer and the job queue,
and is never authoritative. The HTTP contract lives in
[`packages/openapi/openapi.yaml`](../../packages/openapi/openapi.yaml) (ADR 003) and a test fails
if the code and the contract diverge.

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Request lifecycle](#request-lifecycle)
- [Security model](#security-model)
- [Endpoints](#endpoints)
- [Configuration](#configuration)
- [Database and migrations](#database-and-migrations)
- [Testing](#testing)
- [Production](#production)
- [Conventions](#conventions)
- [Known limitations](#known-limitations)

---

## Quick start

Requires Node ≥ 20.11 and Docker.

```bash
# from the repository root
npm install
docker compose up -d                                   # Postgres :5432, Redis :6379
npm run build --workspace=@echoguide/openapi           # generates the Zod schemas the API imports

cp apps/api/.env.example apps/api/.env
# set AUTH_TOKEN_SECRET in apps/api/.env:   openssl rand -hex 32

npm run db:migrate:dev --workspace=@echoguide/api
npm run dev --workspace=@echoguide/api                 # http://localhost:4000
```

The server validates its configuration at startup and exits naming any missing or invalid
variable. `GET /health` answers once it is up; `GET /ready` confirms Postgres and Redis.

---

## Architecture

```
src/
├── app/                      composition root — the only place infrastructure is created
│   ├── server.ts             HTTP entry point: config, startup checks, graceful shutdown
│   ├── worker.ts             background worker entry point (also runs in-process)
│   ├── container.ts          builds every service from config (dependency wiring)
│   ├── app.ts                middleware order, route mounting, per-route limits
│   ├── request-context.ts    request id, trace id, access log
│   ├── error-handler.ts      HttpError → safe JSON; everything else → generic 500
│   └── smoke.ts              post-deploy smoke check against a running instance
│
├── modules/                  one folder per business domain
│   ├── auth/                 device registration, sessions, authenticateRequest
│   ├── users/                GET /v1/users/me
│   ├── commands/             the pipeline, confidence gate, per-app grants
│   ├── vocabulary/           per-user speech-recognition bias terms
│   ├── consent/              append-only consent, data deletion jobs
│   ├── telemetry/            outcome events, Redis buffer → command_events
│   ├── billing/              entitlement, subscription state, PaymentProvider port
│   ├── phrases/              pre-synthesised phrase catalogue
│   └── admin/                admin credentials, permission guard, audit log, operator CLI
│
├── shared/                   cross-cutting infrastructure, no business rules
│   ├── config.ts             Zod-validated environment → typed AppConfig
│   ├── database/             Drizzle schema, enums, client, migrate, rollback
│   ├── redis/                client (fail-fast) and key naming
│   ├── adapters/             Addis AI transport + response adapter
│   ├── resilience/           circuit breaker
│   ├── idempotency/          Redis-backed idempotency store
│   ├── security/             tokens, rate limiter, CORS policy
│   ├── storage/              StorageService port + none/local drivers
│   ├── logger.ts             structured logging with redaction
│   ├── context.ts            AsyncLocalStorage request scope
│   ├── errors.ts, http.ts    HttpError helpers, asyncHandler, UUID checks
│
├── test/                     integration harness, fixtures, golden audio corpus
└── types/express.d.ts        typed req.principal / req.admin
```

### Inside a module

Each module keeps the same shape, and dependencies point one way:

| File | Layer | Rule |
| --- | --- | --- |
| `*.module.ts` | presentation | Express router: parse, validate, call the service, respond. No SQL. |
| `*.service.ts` | application | Use cases and policy. No Express types. |
| `*.repository.ts` | infrastructure | Drizzle queries for this module's tables only. |
| `*.test.ts` | — | Unit tests next to the code they cover. |

Modules are factories (`authModule(authService)`), not singletons, so tests build the real app
around real infrastructure. A module never queries another module's tables; it calls that
module's service (the pipeline asks `BillingService`, never `subscriptions` directly).

### Ports and adapters

Anything outside the process sits behind an interface, so it can be replaced or faked in one place:

| Port | Implementations | Selected by |
| --- | --- | --- |
| `TranscriptionPort`, `PlanningPort` | `AddisAIAdapter` | always (overridable in tests) |
| `StorageService` | `NoStorageService`, `LocalStorageService` | `STORAGE_DRIVER` |
| `PaymentProvider` | `NoPaymentProvider` | `BILLING_PROVIDER` |

---

## Request lifecycle

Middleware order in `app/app.ts`, for every request:

1. **request context**: accept a UUID `X-Request-ID` or generate one; echo it; open a log scope
2. **helmet**: security headers
3. **CORS**: refuse any `Origin` not in `CORS_ORIGINS` with 403
4. **per-IP rate limit**: coarse ceiling for every route
5. **body parser**: 1 MB for `/v1/commands`, 16 KB everywhere else (413 above)
6. **authentication**: `authenticateRequest` (users) or `authenticateAdmin` + `requirePermission`
7. **per-user rate limit**: plus a tighter one for commands
8. **handler**
9. **error handler**: safe JSON errors; never provider, SQL or stack detail

### The command pipeline — `POST /v1/commands`

```
validate headers + body (audio 0.4–15 s, UUID idempotency key)
  → idempotency: replay a finished response, wait for an in-flight one, or claim the key
  → billing gate            (disabled | enforced; UNKNOWN is refused, never allowed)
  → transcribe              (Addis STT, 8 s timeout, circuit breaker)
  → confidence gate         (VALIDATED | LOW_CONFIDENCE | NO_SPEECH | REPETITION |
                             EMPTY_TRANSCRIPT | CONFIDENCE_UNAVAILABLE)
  → plan                    (Addis LLM, 6 s timeout, circuit breaker)
  → validate plan           (ActionPlan contract, non-empty)
  → per-app allowlist       (the user's latest grant for the plan's package)
  → confirmation policy     (destructive step, planner request, or unavailable confidence)
  → ACCEPTED | CONFIRMATION_REQUIRED | REPROMPT | REJECTED
```

Provider failures become defined statuses: **502** unreadable response, **503** provider failing
or breaker open (with `Retry-After`), **504** timeout. The transcript exists only inside this
function; it is never logged or stored.

**Confidence.** Docs say the transcriber returns no score. A missing score is never turned into a
number: by default (`ADDIS_UNAVAILABLE_CONFIDENCE_POLICY=confirm`) the plan is made but must be
confirmed aloud before anything runs. The response shapes the adapter accepts are documented as
assumptions in `shared/adapters/addis_ai_response_adapter.ts` and `test/fixtures/addis/`.

---

## Security model

| Concern | Design |
| --- | --- |
| User identity | Opaque 256-bit session token (`egs_…`), HMAC-hashed at rest, bound to the install id. Every request sends `Authorization: Bearer` **and** `X-Install-ID`. See ADR 005. |
| Session lifecycle | One live session per device. Register/refresh revoke the previous one (no fixation). Refresh allowed within a grace period after expiry; revoked tokens never. |
| Install id hijack | Re-registering an existing install requires that device's session, otherwise 409. |
| Account linking | Phone hashes are accepted and ignored: no verification exists, and an unverified hash would let anyone claim an account. |
| Authorisation | Handlers read the user only from `req.principal`. Resources of other users return 404. |
| Suspension | `users.status`. A suspended account gets 403 on every route, including register and refresh. |
| Admins | Separate table, `ega_…` tokens, permission rows (`users.read`, `users.suspend`, …), every call audited including denials. |
| Deletion | Credentials stop immediately; a durable job deletes storage then rows; `completed` only when all succeeded. |
| Logging | Never tokens, keys, phone hashes, audio, transcripts, vocabulary or plan payloads; a line with a user id and speech is dropped entirely. Driver errors are logged by class and code, never message. |
| Abuse | Redis rate limits keyed by user or IP (never connection); `X-Forwarded-For` trusted only via `TRUST_PROXY`. |

---

## Endpoints

Full schemas, errors and examples: `packages/openapi/openapi.yaml`.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness, no dependencies |
| GET | `/ready` | — | 503 without Postgres |
| POST | `/v1/auth/register-device` | optional | 409 if the install is taken |
| POST | `/v1/auth/refresh` | session | Rotates the token |
| POST | `/v1/auth/logout` | session | 204 |
| GET | `/v1/users/me` | session | |
| POST | `/v1/commands` | session | Idempotent via `X-Idempotency-Key` |
| POST / GET | `/v1/app-grants` | session | Append-only per-app grants |
| GET / POST | `/v1/vocabulary` | session | ≤ 500 terms, unique ignoring case |
| PATCH / DELETE | `/v1/vocabulary/{termId}` | session | |
| POST | `/v1/consent/grants` | session | Append-only |
| GET | `/v1/consent/grants/current` | session | |
| DELETE | `/v1/consent/user-data` | session | 202 + job id |
| GET | `/v1/consent/user-data/jobs/{taskId}` | capability | Job progress |
| POST | `/v1/telemetry/events` | session | 202, never transcripts |
| GET | `/v1/billing/entitlement` | session | |
| GET | `/v1/phrases` | — | |
| GET | `/v1/admin/users/{userId}` | admin `users.read` | Audited |
| POST | `/v1/admin/users/{userId}/suspend` | admin `users.suspend` | Audited, idempotent |
| POST | `/v1/admin/users/{userId}/reinstate` | admin `users.suspend` | Audited, idempotent |

---

## Configuration

Every variable is listed and explained in [`.env.example`](./.env.example) and validated by
[`src/shared/config.ts`](./src/shared/config.ts). The two stay in sync exactly.

| Always required | Also required when `NODE_ENV=production` |
| --- | --- |
| `DATABASE_URL`, `REDIS_URL`, `AUTH_TOKEN_SECRET` (≥ 32 chars) | `ADDIS_AI_API_KEY`, `BILLING_MODE`, `STORAGE_DRIVER`, `CORS_ORIGINS` |

Production also refuses `TRUST_PROXY=true` and a wildcard CORS origin. Everything else has a
documented default.

---

## Database and migrations

- Schema: [`src/shared/database/schema.ts`](./src/shared/database/schema.ts); closed value sets in
  `enums.ts` become CHECK constraints.
- Migrations: `drizzle/NNNN_*.sql`, each with a hand-written rollback in `drizzle/down/`.
- `command_events` is partitioned monthly (`create_command_events_partition(date)`).
- Tables that must outlive a user (`audit_logs`, `deletion_jobs`) deliberately have no foreign key
  to `users`.

| Task | Command |
| --- | --- |
| Create a migration after editing the schema | `npm run db:generate` (then write its `drizzle/down/` file) |
| Apply migrations (development) | `npm run db:migrate:dev` |
| Apply migrations (production, from the build) | `npm run db:migrate` |
| Revert the latest migration | `npm run db:rollback` (or `:dev`) |

Migrations only go forward, run under an advisory lock (safe with concurrent deploys), and never
drop or recreate data. Read a rollback file before running it; some refuse if data would be lost.

---

## Testing

Tests run against **real Postgres and Redis**, not mocks. Each test file gets its own database
cloned from a migrated template and its own Redis key prefix, so files run in parallel. Addis AI
is replaced by a real local HTTP server with programmable responses.

```bash
npm run test:infra:up      # disposable Postgres :55432 and Redis :56379, data in memory
npm test                   # everything
npm run test:unit          # no infrastructure needed
npm run test:integration
npm run test:infra:down
npm run typecheck
```

| Suite | Covers |
| --- | --- |
| `test/integration/auth` | registration, hijack attempts, malformed/expired/revoked tokens, refresh, logout |
| `test/integration/users-admin` | `/me` isolation, 401/403, permissions, suspension, audit rows |
| `test/integration/commands` | pipeline outcomes, confidence policy, provider failures, breaker, idempotency, billing |
| `test/integration/deletion-telemetry` | job lifecycle, retry, idempotency, failure, worker, telemetry buffer |
| `test/integration/vocabulary` | CRUD, limits, cross-user access |
| `test/integration/security` | CORS, body limits, rate limits, auth sweep over every route |
| `test/integration/contract` | routes ⇔ `openapi.yaml`, documented auth and error codes |
| `test/integration/golden-audio` | golden corpus replayed through the real pipeline |
| `*.test.ts` next to code | breaker, adapter, gate, config, logger, tokens, billing, storage |

**Golden audio.** [`src/test/golden/`](./src/test/golden/README.md) holds the corpus manifest.
Replay mode runs in CI with synthetic audio and recorded provider responses. Live mode
(`npm run test:golden:live`, needs `ADDIS_AI_API_KEY` and approved recordings, which are never
committed) measures word error rate against the real vendor, and skips with a reason otherwise.

---

## Production

```bash
npm ci
npm run build --workspace=@echoguide/openapi
npm run build --workspace=@echoguide/api
npm run db:migrate --workspace=@echoguide/api
npm run start --workspace=@echoguide/api
SMOKE_BASE_URL=https://<host> npm run smoke --workspace=@echoguide/api
```

- **Probes:** `/health` for liveness, `/ready` for routing traffic.
- **Shutdown:** `SIGTERM` drains connections, stops the worker and closes pools (forced after 25 s).
- **Worker:** deletion jobs and the telemetry flush run in each API process by default. To split,
  set `WORKER_ENABLED=false` and run `npm run start:worker`. Any number of workers is safe.
- **Degradation:** Postgres down → startup fails / 503. Redis down → rate limits, idempotency and
  telemetry are off and an alert is logged; commands still run.
- **Admin access:** `npm run admin -- create|issue-token|revoke|disable --email …`.

Deploy steps, admin access, alerts and deletion-job recovery:
[`docs/runbooks/production-operations.md`](../../docs/runbooks/production-operations.md).
Vendor outages: [`docs/runbooks/vendor-outage-mitigation.md`](../../docs/runbooks/vendor-outage-mitigation.md).

### Scripts

| Script | Purpose |
| --- | --- |
| `dev` | Watch mode (development only) |
| `build` / `typecheck` | Compile to `dist/` (tests excluded) / type-check everything |
| `start` / `start:worker` | Run the API / the worker alone from `dist/` |
| `smoke` | Smoke-check a running instance |
| `test`, `test:unit`, `test:integration`, `test:golden:live` | See [Testing](#testing) |
| `test:infra:up` / `test:infra:down` | Disposable test Postgres and Redis |
| `db:generate`, `db:migrate`, `db:migrate:dev`, `db:rollback`, `db:rollback:dev` | See [migrations](#database-and-migrations) |
| `admin` | Admin account CLI |

---

## Conventions

**Adding an endpoint**
1. Describe it in `packages/openapi/openapi.yaml` (security, parameters, every status it can return) and rebuild the package.
2. Validate input with the generated `z*` schema; add `.strict()` where the contract says `additionalProperties: false` (the generator drops it).
3. Mount it behind `authenticate`, and take the user from `principalOf(req)` only.
4. Throw `HttpError` helpers from `shared/errors.ts` for expected failures; let everything else reach the error handler.
5. Add an integration test, including a cross-user case if the route touches user data. The contract test will fail until the spec and route agree.

**Adding a module:** create `modules/<name>/` with the files above, construct its service in
`app/container.ts`, mount its router in `app/app.ts`.

**Changing the schema:** edit `schema.ts`, `npm run db:generate`, write the `down/` file, and run
the suite: the test template database rebuilds automatically when a migration is added.

**Logging:** use `logStructured(event, fields)` with snake_case event names (`module.what`). Pass
identifiers and counts, never content; use `describeError(error)` for errors.

---

## Known limitations

- **No verified identity.** Without phone verification each install is its own account, so a
  suspended user can reinstall. Devices registered before sessions existed start a new account.
- **Authentication needs Postgres**, so a Postgres outage stops commands (503).
- **Admin tokens come from the operator CLI**; there is no admin login or SSO.
- **No payment provider or cloud storage adapter.** `PaymentProvider` and `StorageService` are the
  integration points; audio retention does not exist, so there is nothing to store yet.
- **The Addis AI response schema is unconfirmed.** Accepted shapes are listed as assumptions; the
  live golden run confirms them. Vocabulary terms are not sent to the vendor until
  `ADDIS_STT_VOCABULARY_FIELD` is confirmed.
