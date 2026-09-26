import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService, NoStorageService, StorageNotConfiguredError } from './storage.service';

const dirs: string[] = [];
after(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('NoStorageService', () => {
  test('refuses writes, so nothing can be stored that deletion would miss', async () => {
    await assert.rejects(new NoStorageService().putUserObject(), StorageNotConfiguredError);
  });

  test('deletion truthfully reports zero objects', async () => {
    assert.deepEqual(await new NoStorageService().deleteUserObjects(), { deleted: 0 });
  });
});

describe('LocalStorageService', () => {
  test('deletes exactly one user prefix, idempotently', async () => {
    const root = await mkdtemp(join(tmpdir(), 'storage-test-'));
    dirs.push(root);
    const storage = new LocalStorageService(root);
    const a = randomUUID();
    const b = randomUUID();
    await storage.putUserObject(a, 'one.wav', new Uint8Array([1]));
    await storage.putUserObject(b, 'two.wav', new Uint8Array([2]));
    assert.deepEqual(await storage.deleteUserObjects(a), { deleted: 1 });
    assert.deepEqual(await storage.deleteUserObjects(a), { deleted: 0 });
    assert.deepEqual(await readdir(join(root, 'users')), [b]);
  });

  test('refuses path traversal through user ids or object names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'storage-test-'));
    dirs.push(root);
    const storage = new LocalStorageService(root);
    await assert.rejects(storage.deleteUserObjects('../../etc'));
    await assert.rejects(storage.deleteUserObjects(''));
    await assert.rejects(storage.putUserObject(randomUUID(), '../escape', new Uint8Array()));
    await assert.rejects(storage.putUserObject(randomUUID(), '.hidden', new Uint8Array()));
    assert.equal(await stat(join(root, '..', 'escape')).then(() => true, () => false), false);
  });
});
