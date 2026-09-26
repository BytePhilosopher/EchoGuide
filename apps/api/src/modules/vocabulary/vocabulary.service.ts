import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { Database } from '../../shared/database/client';
import type { VocabularyKind } from '../../shared/database/enums';
import { vocabularyTerms } from '../../shared/database/schema';
import { conflict, notFound } from '../../shared/errors';
import { isUuid } from '../../shared/http';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '../../shared/database/errors';
import { MAX_TERMS_PER_USER } from './vocabulary.schema';

export type VocabularyTermView = {
  term_id: string;
  term: string;
  kind: VocabularyKind;
  created_at: string;
  updated_at: string;
};

type Row = typeof vocabularyTerms.$inferSelect;

const view = (row: Row): VocabularyTermView => ({
  term_id: row.id,
  term: row.term,
  kind: row.kind as VocabularyKind,
  created_at: row.createdAt.toISOString(),
  updated_at: row.updatedAt.toISOString(),
});

const isUniqueViolation = (error: unknown) => pgErrorCode(error) === PG_UNIQUE_VIOLATION;

/**
 * Per-user vocabulary: names from contacts, installed apps and custom words that bias speech
 * recognition toward what this user actually says (docs: architecture/backend).
 *
 * Every query is filtered by the owner's user id, taken from the authenticated principal. A term
 * that belongs to someone else is indistinguishable from one that does not exist (404).
 * Terms are contact data: they are never logged and never sent to the planner, only offered to
 * transcription through `biasTerms`.
 */
export class VocabularyService {
  constructor(private readonly db: Database) {}

  async list(userId: string): Promise<VocabularyTermView[]> {
    const rows = await this.db
      .select()
      .from(vocabularyTerms)
      .where(eq(vocabularyTerms.userId, userId))
      .orderBy(asc(vocabularyTerms.createdAt), asc(vocabularyTerms.id));
    return rows.map(view);
  }

  async create(userId: string, input: { term: string; kind: VocabularyKind }): Promise<VocabularyTermView> {
    return this.db.transaction(async (tx) => {
      // Serialise creates per user so the quota cannot be raced past.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`vocabulary:${userId}`}))`);
      const [{ value }] = await tx.select({ value: count() }).from(vocabularyTerms).where(eq(vocabularyTerms.userId, userId));
      if (value >= MAX_TERMS_PER_USER) throw conflict(`Vocabulary is limited to ${MAX_TERMS_PER_USER} terms`);
      try {
        const [row] = await tx.insert(vocabularyTerms).values({ userId, term: input.term, kind: input.kind }).returning();
        return view(row);
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict('Term already exists');
        throw error;
      }
    });
  }

  async update(userId: string, termId: string, input: { term?: string; kind?: VocabularyKind }): Promise<VocabularyTermView> {
    if (!isUuid(termId)) throw notFound('Term not found');
    try {
      const rows = await this.db
        .update(vocabularyTerms)
        .set({ ...input, updatedAt: sql`now()` })
        .where(and(eq(vocabularyTerms.id, termId), eq(vocabularyTerms.userId, userId)))
        .returning();
      if (!rows[0]) throw notFound('Term not found');
      return view(rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('Term already exists');
      throw error;
    }
  }

  async remove(userId: string, termId: string): Promise<void> {
    if (!isUuid(termId)) throw notFound('Term not found');
    const rows = await this.db
      .delete(vocabularyTerms)
      .where(and(eq(vocabularyTerms.id, termId), eq(vocabularyTerms.userId, userId)))
      .returning({ id: vocabularyTerms.id });
    if (!rows[0]) throw notFound('Term not found');
  }

  /** Terms to bias transcription with, most recently touched first, capped for request size. */
  async biasTerms(userId: string, limit = 100): Promise<string[]> {
    const rows = await this.db
      .select({ term: vocabularyTerms.term })
      .from(vocabularyTerms)
      .where(eq(vocabularyTerms.userId, userId))
      .orderBy(sql`${vocabularyTerms.updatedAt} DESC`)
      .limit(limit);
    return rows.map((row) => row.term);
  }
}
