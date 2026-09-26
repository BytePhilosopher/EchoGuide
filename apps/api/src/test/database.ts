import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { MIGRATIONS_DIR, runMigrations } from '../shared/database/migrate';

// Disposable infrastructure from docker-compose.test.yml. Test-only credentials, not secrets.
export const TEST_DATABASE_ADMIN_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://echoguide_test:echoguide_test@localhost:55432/postgres';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:56379/0';

const TEMPLATE = 'echoguide_test_template';
const LOCK_KEY = 4_242_424_242;

function urlFor(database: string): string {
  const url = new URL(TEST_DATABASE_ADMIN_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

async function connectAdmin(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DATABASE_ADMIN_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Integration tests need the disposable test database. Start it with:\n` +
        `  npm run test:infra:up --workspace=@echoguide/api\n` +
        `(or set TEST_DATABASE_URL). Cause: ${(error as Error).message}`,
    );
  }
  return client;
}

async function templateIsCurrent(expected: number): Promise<boolean> {
  const client = new Client({ connectionString: urlFor(TEMPLATE) });
  try {
    await client.connect();
    const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM drizzle.__drizzle_migrations');
    return Number(rows[0].count) === expected;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Creates a fresh database for one test file, cloned from a template that has every migration
 * applied. The template is rebuilt whenever a migration is added. Cloning is a file copy, so each
 * file starts from a clean, fully migrated schema in milliseconds and files cannot interfere.
 */
export async function createTestDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')) as { entries: unknown[] };
  const name = `echoguide_test_${randomBytes(6).toString('hex')}`;
  const admin = await connectAdmin();
  try {
    await admin.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    try {
      if (!(await templateIsCurrent(journal.entries.length))) {
        await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE} WITH (FORCE)`);
        await admin.query(`CREATE DATABASE ${TEMPLATE}`);
        await runMigrations(urlFor(TEMPLATE));
      }
      await admin.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE}`);
    } finally {
      await admin.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    await admin.end();
  }
  return {
    url: urlFor(name),
    drop: async () => {
      const client = await connectAdmin();
      try {
        await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await client.end();
      }
    },
  };
}
