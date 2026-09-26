import 'dotenv/config';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Same depth from src/ and dist/, so this resolves to apps/api/drizzle in both.
export const MIGRATIONS_DIR = join(__dirname, '../../../drizzle');

// Arbitrary constant shared by every instance, so concurrent deploys apply migrations one at a time.
const MIGRATION_LOCK_KEY = 7_311_904_455;

/**
 * Applies pending migrations from drizzle/ in order. Uses the runtime drizzle-orm migrator, so it
 * works from the compiled build without dev dependencies. It never drops or recreates anything:
 * it only runs forward migrations that are not yet recorded in drizzle.__drizzle_migrations.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(JSON.stringify({ event: 'db.migrate.failed', error: 'DATABASE_URL is not set' }));
    process.exit(1);
  }
  runMigrations(connectionString)
    .then(() => console.log(JSON.stringify({ event: 'db.migrate.done' })))
    .catch((error: unknown) => {
      const code = (error as { code?: string }).code;
      console.error(
        JSON.stringify({
          event: 'db.migrate.failed',
          error: error instanceof Error ? error.name : 'unknown',
          code,
          // Migration failures are operator-facing and contain SQL, never user data.
          message: error instanceof Error ? error.message : undefined,
        }),
      );
      process.exit(1);
    });
}
