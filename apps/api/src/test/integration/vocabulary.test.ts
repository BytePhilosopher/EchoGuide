import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { zVocabularyList, zVocabularyTerm } from '@echoguide/openapi';
import { MAX_TERMS_PER_USER } from '../../modules/vocabulary/vocabulary.schema';
import { vocabularyTerms } from '../../shared/database/schema';
import { startHarness, type Harness, type TestUser } from '../harness';

let h: Harness;
before(async () => {
  h = await startHarness();
});
after(async () => {
  await h.close();
});

type Term = { term_id: string; term: string; kind: string };

const create = (user: TestUser, body: unknown) =>
  h.json<Term>('/v1/vocabulary', { method: 'POST', headers: { 'content-type': 'application/json', ...user.headers }, body: JSON.stringify(body) });
const patch = (user: TestUser, id: string, body: unknown) =>
  h.json<Term>(`/v1/vocabulary/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...user.headers }, body: JSON.stringify(body) });
const remove = (user: TestUser, id: string) => h.fetch(`/v1/vocabulary/${id}`, { method: 'DELETE', headers: user.headers });
const list = (user: TestUser) => h.json<{ terms: Term[] }>('/v1/vocabulary', { headers: user.headers });

describe('vocabulary CRUD', () => {
  test('create, read, update and delete a term', async () => {
    const user = await h.registerUser();
    const created = await create(user, { term: '  አበበ ', kind: 'contact' });
    assert.equal(created.status, 201);
    zVocabularyTerm.parse(created.body);
    assert.equal(created.body.term, 'አበበ', 'trimmed');

    const read = await list(user);
    zVocabularyList.parse(read.body);
    assert.deepEqual(read.body.terms.map((t) => t.term), ['አበበ']);

    const updated = await patch(user, created.body.term_id, { term: 'Abebe Kebede', kind: 'custom' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.term, 'Abebe Kebede');
    assert.equal(updated.body.kind, 'custom');

    assert.equal((await remove(user, created.body.term_id)).status, 204);
    assert.deepEqual((await list(user)).body.terms, []);
    assert.equal((await remove(user, created.body.term_id)).status, 404);
  });

  test('duplicates are refused case-insensitively by a database constraint', async () => {
    const user = await h.registerUser();
    await create(user, { term: 'Telegram', kind: 'app' });
    assert.equal((await create(user, { term: 'telegram', kind: 'app' })).status, 409);
    // The same word is fine for a different user.
    const other = await h.registerUser();
    assert.equal((await create(other, { term: 'Telegram', kind: 'app' })).status, 201);
  });

  test('invalid terms are refused', async () => {
    const user = await h.registerUser();
    for (const body of [{ term: '', kind: 'contact' }, { term: 'x'.repeat(65), kind: 'contact' }, { term: 'a\nb', kind: 'contact' }, { term: 'ok', kind: 'password' }, { term: 'ok' }, { term: 'ok', kind: 'app', user_id: randomUUID() }]) {
      assert.equal((await create(user, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await patch(user, randomUUID(), {})).status, 400);
  });

  test(`a user cannot exceed ${MAX_TERMS_PER_USER} terms`, async () => {
    const user = await h.registerUser();
    await h.c.db.insert(vocabularyTerms).values(
      Array.from({ length: MAX_TERMS_PER_USER }, (_, i) => ({ userId: user.userId, term: `term-${i}`, kind: 'custom' })),
    );
    assert.equal((await create(user, { term: 'one-too-many', kind: 'custom' })).status, 409);
  });

  test('unauthenticated access → 401', async () => {
    assert.equal((await h.fetch('/v1/vocabulary')).status, 401);
    assert.equal((await h.fetch('/v1/vocabulary', { method: 'POST' })).status, 401);
  });
});

describe('vocabulary isolation', () => {
  test("user A can neither see, change nor delete user B's terms", async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    const bTerm = (await create(b, { term: 'Private Contact', kind: 'contact' })).body;

    assert.deepEqual((await list(a)).body.terms, []);
    const patched = await patch(a, bTerm.term_id, { term: 'hijacked' });
    assert.equal(patched.status, 404, 'indistinguishable from a term that does not exist');
    assert.equal((await remove(a, bTerm.term_id)).status, 404);

    const bTerms = (await list(b)).body.terms;
    assert.deepEqual(bTerms.map((t) => t.term), ['Private Contact']);
  });

  test('terms are never written to logs', async () => {
    const user = await h.registerUser();
    await create(user, { term: 'Zewditu-Secret-Contact', kind: 'contact' });
    assert.equal(h.logs.some((l) => l.includes('Zewditu-Secret-Contact')), false);
  });
});
