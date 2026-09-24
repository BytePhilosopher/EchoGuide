import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

let db: Database | null | undefined;

export function getDb(): Database | null {
  if (db !== undefined) return db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    db = null;
    return null;
  }
  db = drizzle(new Pool({ connectionString: url }), { schema });
  return db;
}
