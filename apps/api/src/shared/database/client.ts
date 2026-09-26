import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export type DatabaseHandle = { db: Database; pool: Pool };

/** Postgres is the source of truth; there is no in-memory fallback when it is not configured. */
export function createDatabase(connectionString: string, max = 10): DatabaseHandle {
  const pool = new Pool({ connectionString, max, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  pool.on('error', () => {
    // Idle client errors are surfaced by the next query; keep the process alive.
  });
  return { db: drizzle(pool, { schema }), pool };
}
