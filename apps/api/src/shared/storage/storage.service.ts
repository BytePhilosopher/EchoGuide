import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { isUuid } from '../http';

/**
 * Object storage for per-user blobs (retained audio, once retention exists). Every object a user
 * owns lives under `users/<userId>/`, so deletion is one prefix removal.
 *
 * Retention is not built yet (docs: architecture/data, reference/privacy), so no code path writes
 * user audio today. The production adapter boundary is this interface: an S3 or GCS adapter
 * implements it when retention lands, and the deletion job needs no change.
 */
export interface StorageService {
  readonly driver: string;
  putUserObject(userId: string, name: string, data: Uint8Array): Promise<void>;
  /** Removes every object under the user's prefix. Idempotent: removing nothing succeeds. */
  deleteUserObjects(userId: string): Promise<{ deleted: number }>;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('storage_not_configured');
    this.name = 'StorageNotConfiguredError';
  }
}

/**
 * No object store configured. Writes are refused, so nothing can be stored that deletion would
 * then miss; deletion therefore has nothing to remove and reports zero objects, truthfully.
 */
export class NoStorageService implements StorageService {
  readonly driver = 'none';

  async putUserObject(): Promise<void> {
    throw new StorageNotConfiguredError();
  }

  async deleteUserObjects(): Promise<{ deleted: number }> {
    return { deleted: 0 };
  }
}

/** Filesystem-backed storage for development and tests. Not for multi-instance production. */
export class LocalStorageService implements StorageService {
  readonly driver = 'local';
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private userDir(userId: string): string {
    if (!isUuid(userId)) throw new Error('invalid_user_id');
    const dir = resolve(this.root, 'users', userId);
    if (!dir.startsWith(this.root + sep)) throw new Error('invalid_user_id');
    return dir;
  }

  async putUserObject(userId: string, name: string, data: Uint8Array): Promise<void> {
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.startsWith('.')) throw new Error('invalid_object_name');
    const dir = this.userDir(userId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), data);
  }

  async deleteUserObjects(userId: string): Promise<{ deleted: number }> {
    const dir = this.userDir(userId);
    const existed = await stat(dir).then(
      () => true,
      () => false,
    );
    await rm(dir, { recursive: true, force: true });
    return { deleted: existed ? 1 : 0 };
  }
}

export function createStorage(config: { driver: 'none' | 'local'; localDir: string | undefined }): StorageService {
  if (config.driver === 'local') return new LocalStorageService(config.localDir ?? '');
  return new NoStorageService();
}
