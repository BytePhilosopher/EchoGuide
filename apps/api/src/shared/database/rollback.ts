import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = join(__dirname, '../../../drizzle');

type JournalEntry = { when: number; tag: string };
type AppliedMigration = { id: number; created_at: string };

async function findJournalEntry(appliedAt: string): Promise<JournalEntry> {
  const journal: { entries: JournalEntry[] } = JSON.parse(
    await readFile(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8'),
  );
  const entry = journal.entries.find((candidate) => String(candidate.when) === appliedAt);
  if (!entry) throw new Error(`No journal entry for applied migration at ${appliedAt}`);
  return entry;
}

async function rollbackLatest(pool: Pool): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<AppliedMigration>(
      'SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1 FOR UPDATE',
    );
    const latest = rows[0];
    if (!latest) {
      await client.query('ROLLBACK');
      return null;
    }
    const entry = await findJournalEntry(latest.created_at);
    const downSql = await readFile(join(MIGRATIONS_DIR, 'down', `${entry.tag}.sql`), 'utf8');
    await client.query(downSql);
    await client.query('DELETE FROM drizzle.__drizzle_migrations WHERE id = $1', [latest.id]);
    await client.query('COMMIT');
    return entry.tag;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });
  try {
    const tag = await rollbackLatest(pool);
    console.log(JSON.stringify({ event: 'db.rollback', migration: tag ?? 'none' }));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'db.rollback.failed', error: error instanceof Error ? error.message : 'unknown' }));
  process.exit(1);
});
