# Operational Runbook: API Deploy, Migrations, Admin Access, Deletion

## Deploy

```bash
npm ci
npm run build --workspace=@echoguide/openapi
npm run build --workspace=@echoguide/api
npm run db:migrate --workspace=@echoguide/api   # forward-only, idempotent, advisory-locked
npm run start --workspace=@echoguide/api        # never `dev` (a file watcher) in production
SMOKE_BASE_URL=https://<host> npm run smoke --workspace=@echoguide/api
```

- Startup validates every variable in `apps/api/.env.example` and exits non-zero naming what is wrong (never values). Production additionally requires `ADDIS_AI_API_KEY`, `BILLING_MODE`, `STORAGE_DRIVER` and `CORS_ORIGINS`, and refuses `TRUST_PROXY=true`.
- Startup exits if Postgres is unreachable. Redis unreachable is logged (`api.redis_unavailable_at_start`) and the API runs degraded.
- Probes: `/health` for liveness (no dependencies), `/ready` for traffic (503 without Postgres).
- `SIGTERM` stops accepting connections, drains, stops the worker, closes pools; forced exit after 25 s.
- Migrations only go forward. `db:rollback` reverts the latest migration using `drizzle/down/`; read that file first — some rollbacks refuse to run if data would be lost.

## Background worker

Deletion jobs and the telemetry flush run inside each API process (`WORKER_ENABLED=true`). To run them separately: `WORKER_ENABLED=false` on the API and `npm run start:worker` elsewhere. Any number of workers is safe.

## Admin access

There is no admin login screen. An operator with database access issues credentials:

```bash
npm run admin --workspace=@echoguide/api -- create --email agent@example.com --name "Agent" --permissions users.read,users.suspend
npm run admin --workspace=@echoguide/api -- issue-token --email agent@example.com   # prints the token once
npm run admin --workspace=@echoguide/api -- revoke --email agent@example.com
npm run admin --workspace=@echoguide/api -- disable --email agent@example.com
```

Every action, including permission denials, is written to `audit_logs`.

## Deletion jobs

- Alert on log event `deletion.job.failed` (a job hit `DELETION_JOB_MAX_ATTEMPTS`). The user's data is **not** deleted; the job id is in the event.
- Inspect: `SELECT id, status, attempts, last_error, next_attempt_at FROM deletion_jobs WHERE status IN ('retrying','failed');`
- After fixing the cause, re-queue: `UPDATE deletion_jobs SET status='retrying', next_attempt_at=now() WHERE id='<id>';` (the worker picks it up within one poll interval).

## Alerts worth wiring

| Log event | Meaning |
| --- | --- |
| `addis.breaker` with `to: OPEN` | Vendor outage; see vendor-outage-mitigation.md |
| `addis.schema_mismatch` | Vendor response changed shape; field paths are in the event |
| `rate_limit.unavailable`, `idempotency.unavailable`, `telemetry.buffer.unavailable` | Redis is down; limits and de-duplication are off |
| `billing.unverified` | Billing enforced but state unknown; commands are refused with 503 |
| `deletion.job.failed` | See above |
