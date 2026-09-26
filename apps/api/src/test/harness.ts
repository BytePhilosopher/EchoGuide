import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app/app';
import { createContainer, type Container, type ContainerOverrides } from '../app/container';
import { parseConfig } from '../shared/config';
import type { AdminPermission } from '../shared/database/enums';
import { adminPermissions, adminUsers } from '../shared/database/schema';
import { setLogSink } from '../shared/logger';
import { waitForRedis } from '../shared/redis/client';
import { createTestDatabase, TEST_REDIS_URL } from './database';
import { FakeAddis } from './fake-addis';

export const TEST_TOKEN_SECRET = 'test-token-secret-0123456789abcdef-0123456789';

export type TestUser = { userId: string; token: string; installId: string; headers: Record<string, string> };

export type Harness = {
  base: string;
  c: Container;
  addis: FakeAddis;
  logs: string[];
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  json: <T = Record<string, unknown>>(path: string, init?: RequestInit) => Promise<{ status: number; body: T; headers: Headers }>;
  registerUser: () => Promise<TestUser>;
  createAdmin: (permissions: AdminPermission[]) => Promise<{ adminId: string; token: string; headers: Record<string, string> }>;
  close: () => Promise<void>;
};

/**
 * Boots the real application against a fresh Postgres database, an isolated Redis key prefix,
 * local file storage and a fake Addis AI server. Nothing inside the app is mocked.
 */
export async function startHarness(
  options: { env?: Record<string, string>; overrides?: ContainerOverrides } = {},
): Promise<Harness> {
  const database = await createTestDatabase();
  const addis = new FakeAddis();
  await addis.start();
  const storageDir = await mkdtemp(join(tmpdir(), 'echoguide-storage-'));
  const prefix = `test:${randomBytes(4).toString('hex')}:`;

  const logs: string[] = [];
  setLogSink((line) => logs.push(line));

  const config = parseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    DATABASE_POOL_MAX: '5',
    REDIS_URL: TEST_REDIS_URL,
    REDIS_KEY_PREFIX: prefix,
    AUTH_TOKEN_SECRET: TEST_TOKEN_SECRET,
    ADDIS_AI_API_KEY: 'test-addis-key',
    ADDIS_AI_BASE_URL: addis.url,
    ADDIS_TRANSCRIBE_TIMEOUT_MS: '800',
    ADDIS_PLAN_TIMEOUT_MS: '800',
    CORS_ORIGINS: 'http://admin.test',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: storageDir,
    BILLING_MODE: 'disabled',
    WORKER_ENABLED: 'false',
    RATE_LIMIT_IP_MAX: '10000',
    RATE_LIMIT_AUTH_MAX: '10000',
    RATE_LIMIT_USER_MAX: '10000',
    RATE_LIMIT_COMMANDS_MAX: '10000',
    ...options.env,
  });
  const c = createContainer(config, options.overrides);
  if (!(await waitForRedis(c.redis, 3000))) {
    await c.close();
    await addis.stop();
    await database.drop();
    throw new Error(`Integration tests need the disposable test Redis at ${TEST_REDIS_URL}. Start it with: npm run test:infra:up --workspace=@echoguide/api`);
  }

  const server: Server = createApp(c).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  const base = `http://127.0.0.1:${address.port}`;

  const fetchApi = (path: string, init?: RequestInit) => fetch(`${base}${path}`, init);
  const json = async <T,>(path: string, init?: RequestInit) => {
    const res = await fetchApi(path, init);
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as T, headers: res.headers };
  };

  const registerUser = async (): Promise<TestUser> => {
    const installId = randomUUID();
    const reg = await json<{ session_token: string }>('/v1/auth/register-device', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ install_id: installId, model: 'Test Phone', locale: 'en-US' }),
    });
    if (reg.status !== 200) throw new Error(`register failed: ${reg.status}`);
    const headers = { authorization: `Bearer ${reg.body.session_token}`, 'x-install-id': installId };
    const me = await json<{ user_id: string }>('/v1/users/me', { headers });
    return { userId: me.body.user_id, token: reg.body.session_token, installId, headers };
  };

  const createAdmin = async (permissions: AdminPermission[]) => {
    const [admin] = await c.db
      .insert(adminUsers)
      .values({ email: `${randomUUID()}@support.test`, displayName: 'Support Agent' })
      .returning();
    if (permissions.length > 0) {
      await c.db.insert(adminPermissions).values(permissions.map((permission) => ({ adminId: admin.id, permission })));
    }
    const { token } = await c.adminAuth.issueSession(admin.id);
    return { adminId: admin.id, token, headers: { authorization: `Bearer ${token}` } };
  };

  return {
    base,
    c,
    addis,
    logs,
    fetch: fetchApi,
    json,
    registerUser,
    createAdmin,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      const keys = await c.redis.keys(`${prefix}*`).catch(() => [] as string[]);
      if (keys.length > 0) await c.redis.del(...keys).catch(() => undefined);
      await c.close();
      await addis.stop();
      await database.drop();
      await rm(storageDir, { recursive: true, force: true });
    },
  };
}

/** 0.8 s of 16 kHz mono PCM16 — long enough to pass the 0.4 s minimum. */
export function audioBase64(ms = 800): string {
  return Buffer.alloc(ms * 32, 1).toString('base64');
}

export function commandBody(overrides: Record<string, unknown> = {}) {
  return {
    audio_base64: audioBase64(),
    duration_ms: 800,
    language: 'en-US',
    screen_context: { current_package: 'com.whatsapp', view_tree_summary: 'n1 Chats\nn2 Send' },
    ...overrides,
  };
}

export function plannerReply(plan: Record<string, unknown>) {
  return () => ({ body: { response_text: JSON.stringify(plan) } });
}
