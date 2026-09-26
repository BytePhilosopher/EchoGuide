import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, parseConfig } from './config';

const BASE = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_TOKEN_SECRET: 'x'.repeat(40),
};
const PRODUCTION = {
  ...BASE,
  NODE_ENV: 'production',
  ADDIS_AI_API_KEY: 'key',
  BILLING_MODE: 'disabled',
  STORAGE_DRIVER: 'none',
  CORS_ORIGINS: 'https://admin.example.com',
  TRUST_PROXY: '1',
};

function issuesOf(env: Record<string, string | undefined>): string[] {
  try {
    parseConfig(env);
    return [];
  } catch (error) {
    assert.ok(error instanceof ConfigError);
    return error.issues;
  }
}

describe('configuration', () => {
  test('development starts with only the three required variables, and safe defaults', () => {
    const config = parseConfig(BASE);
    assert.equal(config.env, 'development');
    assert.equal(config.billing.mode, 'disabled');
    assert.equal(config.storage.driver, 'none');
    assert.equal(config.trustProxy, false);
    assert.ok(config.corsOrigins.every((origin) => origin.startsWith('http://localhost:')));
    assert.equal(config.addis.transcribeTimeoutMs, 8000);
    assert.equal(config.addis.breakerFailureThreshold, 5);
    assert.equal(config.addis.breakerResetMs, 30000);
    assert.equal(config.bodyLimits.jsonBytes, 16384);
  });

  test('missing database, redis or token secret fails fast, naming the variable but not its value', () => {
    const issues = issuesOf({});
    assert.ok(issues.some((i) => i.startsWith('DATABASE_URL')));
    assert.ok(issues.some((i) => i.startsWith('REDIS_URL')));
    assert.ok(issues.some((i) => i.startsWith('AUTH_TOKEN_SECRET')));
  });

  test('a short token secret is refused', () => {
    assert.ok(issuesOf({ ...BASE, AUTH_TOKEN_SECRET: 'short' }).some((i) => i.includes('at least 32')));
  });

  test('a complete production configuration is accepted', () => {
    const config = parseConfig(PRODUCTION);
    assert.deepEqual(config.corsOrigins, ['https://admin.example.com']);
    assert.equal(config.trustProxy, 1);
  });

  test('production refuses to guess billing, storage, CORS or the provider key', () => {
    for (const key of ['ADDIS_AI_API_KEY', 'BILLING_MODE', 'STORAGE_DRIVER', 'CORS_ORIGINS'] as const) {
      const env: Record<string, string | undefined> = { ...PRODUCTION };
      delete env[key];
      assert.ok(issuesOf(env).some((issue) => issue.includes(key)), key);
    }
  });

  test('an empty production CORS list means no browser origin, not all of them', () => {
    assert.deepEqual(parseConfig({ ...PRODUCTION, CORS_ORIGINS: '' }).corsOrigins, []);
  });

  test('wildcard or malformed CORS origins are refused in every environment', () => {
    assert.ok(issuesOf({ ...BASE, CORS_ORIGINS: '*' }).some((i) => i.includes('"*"')));
    assert.ok(issuesOf({ ...BASE, CORS_ORIGINS: 'https://a.example.com/path' }).length > 0);
    assert.ok(issuesOf({ ...BASE, CORS_ORIGINS: 'not a url' }).length > 0);
  });

  test('TRUST_PROXY=true is refused in production because it trusts any X-Forwarded-For', () => {
    assert.ok(issuesOf({ ...PRODUCTION, TRUST_PROXY: 'true' }).some((i) => i.includes('TRUST_PROXY')));
  });

  test('local storage needs a directory', () => {
    assert.ok(issuesOf({ ...BASE, STORAGE_DRIVER: 'local' }).some((i) => i.includes('STORAGE_LOCAL_DIR')));
  });

  test('unknown enum values are refused', () => {
    assert.ok(issuesOf({ ...BASE, BILLING_MODE: 'free' }).length > 0);
    assert.ok(issuesOf({ ...BASE, ADDIS_UNAVAILABLE_CONFIDENCE_POLICY: 'accept' }).length > 0);
    assert.ok(issuesOf({ ...BASE, BILLING_PROVIDER: 'stripe' }).length > 0);
  });
});
