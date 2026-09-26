import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === 'true' || value === '1'));

const int = (fallback: number, min = 0) =>
  z.coerce.number().int().min(min).optional().default(fallback);

const num = (fallback: number) => z.coerce.number().finite().optional().default(fallback);

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const RawConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(4000, 1),
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: z.string().default('false'),

  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().url({ message: 'DATABASE_URL must be a URL' })),
  DATABASE_POOL_MAX: int(10, 1),

  REDIS_URL: z.preprocess(emptyToUndefined, z.string().url({ message: 'REDIS_URL must be a URL' })),
  REDIS_KEY_PREFIX: z.string().default('echoguide:'),

  ADDIS_AI_API_KEY: optionalString,
  ADDIS_AI_BASE_URL: z.string().url().default('https://api.addisassistant.com'),
  ADDIS_TRANSCRIBE_TIMEOUT_MS: int(8000, 1),
  ADDIS_PLAN_TIMEOUT_MS: int(6000, 1),
  ADDIS_BREAKER_FAILURE_THRESHOLD: int(5, 1),
  ADDIS_BREAKER_RESET_MS: int(30000, 1),
  ADDIS_CONFIDENCE_FLOOR: num(0.6).pipe(z.number().min(0).max(1)),
  ADDIS_AVG_LOGPROB_FLOOR: num(-1.0),
  ADDIS_NO_SPEECH_PROB_MAX: num(0.6).pipe(z.number().min(0).max(1)),
  ADDIS_COMPRESSION_RATIO_MAX: num(2.4).pipe(z.number().positive()),
  ADDIS_UNAVAILABLE_CONFIDENCE_POLICY: z.enum(['confirm', 'reprompt']).default('confirm'),
  ADDIS_STT_VOCABULARY_FIELD: optionalString,

  AUTH_TOKEN_SECRET: z.preprocess(
    emptyToUndefined,
    z.string({ required_error: 'AUTH_TOKEN_SECRET is required' }).min(32, 'AUTH_TOKEN_SECRET must be at least 32 characters'),
  ),
  AUTH_SESSION_TTL_SECONDS: int(30 * 24 * 3600, 60),
  AUTH_REFRESH_GRACE_SECONDS: int(30 * 24 * 3600, 0),
  ADMIN_SESSION_TTL_SECONDS: int(8 * 3600, 60),

  RATE_LIMIT_WINDOW_SECONDS: int(60, 1),
  RATE_LIMIT_IP_MAX: int(600, 1),
  RATE_LIMIT_AUTH_MAX: int(20, 1),
  RATE_LIMIT_USER_MAX: int(120, 1),
  RATE_LIMIT_COMMANDS_MAX: int(30, 1),

  IDEMPOTENCY_TTL_SECONDS: int(300, 1),
  IDEMPOTENCY_LOCK_SECONDS: int(30, 1),
  IDEMPOTENCY_WAIT_MS: int(15000, 0),

  CORS_ORIGINS: z.string().optional(),

  JSON_BODY_LIMIT_BYTES: int(16 * 1024, 1024),
  COMMAND_BODY_LIMIT_BYTES: int(1024 * 1024, 1024),

  BILLING_MODE: z.enum(['disabled', 'enforced']).optional(),
  BILLING_PROVIDER: z.enum(['none']).default('none'),
  BILLING_CHECK_TIMEOUT_MS: int(500, 1),

  STORAGE_DRIVER: z.enum(['none', 'local']).optional(),
  STORAGE_LOCAL_DIR: optionalString,

  WORKER_ENABLED: bool(true),
  WORKER_POLL_INTERVAL_MS: int(5000, 10),
  DELETION_JOB_MAX_ATTEMPTS: int(25, 1),
  TELEMETRY_BUFFER_MAX: int(10000, 1),
});

export type AppConfig = {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  trustProxy: boolean | number | string;
  databaseUrl: string;
  databasePoolMax: number;
  redisUrl: string;
  redisKeyPrefix: string;
  addis: {
    apiKey: string;
    baseUrl: string;
    transcribeTimeoutMs: number;
    planTimeoutMs: number;
    breakerFailureThreshold: number;
    breakerResetMs: number;
    confidenceFloor: number;
    avgLogprobFloor: number;
    noSpeechProbMax: number;
    compressionRatioMax: number;
    unavailableConfidencePolicy: 'confirm' | 'reprompt';
    sttVocabularyField: string | undefined;
  };
  auth: {
    tokenSecret: string;
    sessionTtlSeconds: number;
    refreshGraceSeconds: number;
    adminSessionTtlSeconds: number;
  };
  rateLimit: {
    windowSeconds: number;
    ipMax: number;
    authMax: number;
    userMax: number;
    commandsMax: number;
  };
  idempotency: { ttlSeconds: number; lockSeconds: number; waitMs: number };
  corsOrigins: string[];
  bodyLimits: { jsonBytes: number; commandBytes: number };
  billing: { mode: 'disabled' | 'enforced'; provider: 'none'; checkTimeoutMs: number };
  storage: { driver: 'none' | 'local'; localDir: string | undefined };
  worker: {
    enabled: boolean;
    pollIntervalMs: number;
    deletionMaxAttempts: number;
    telemetryBufferMax: number;
  };
};

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

function parseTrustProxy(raw: string): boolean | number | string {
  const value = raw.trim();
  if (value === 'false' || value === '') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const DEV_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4321'];

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = RawConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const raw = parsed.data;
  const production = raw.NODE_ENV === 'production';
  const issues: string[] = [];

  // Production refuses to guess anything with security or data consequences.
  if (production) {
    if (!raw.ADDIS_AI_API_KEY) issues.push('ADDIS_AI_API_KEY is required in production');
    if (!raw.BILLING_MODE) issues.push('BILLING_MODE must be set explicitly in production (disabled or enforced)');
    if (!raw.STORAGE_DRIVER) issues.push('STORAGE_DRIVER must be set explicitly in production (none or local)');
    if (env.CORS_ORIGINS === undefined) {
      issues.push('CORS_ORIGINS must be set in production (empty means no browser origin is allowed)');
    }
    if (parseTrustProxy(raw.TRUST_PROXY) === true) {
      issues.push('TRUST_PROXY=true trusts any X-Forwarded-For; set a hop count or subnet list in production');
    }
  }
  const origins = env.CORS_ORIGINS === undefined && !production ? DEV_CORS_ORIGINS : parseOrigins(raw.CORS_ORIGINS);
  if (origins.includes('*')) issues.push('CORS_ORIGINS must be an explicit list; "*" is not allowed');
  for (const origin of origins) {
    if (origin === '*') continue;
    try {
      const url = new URL(origin);
      if (url.origin !== origin) issues.push(`CORS_ORIGINS entry "${origin}" must be a bare origin like https://admin.example.com`);
    } catch {
      issues.push(`CORS_ORIGINS entry "${origin}" is not a valid origin`);
    }
  }
  const storageDriver = raw.STORAGE_DRIVER ?? 'none';
  if (storageDriver === 'local' && !raw.STORAGE_LOCAL_DIR) {
    issues.push('STORAGE_LOCAL_DIR is required when STORAGE_DRIVER=local');
  }
  if (issues.length > 0) throw new ConfigError(issues);

  return {
    env: raw.NODE_ENV,
    port: raw.PORT,
    host: raw.HOST,
    trustProxy: parseTrustProxy(raw.TRUST_PROXY),
    databaseUrl: raw.DATABASE_URL,
    databasePoolMax: raw.DATABASE_POOL_MAX,
    redisUrl: raw.REDIS_URL,
    redisKeyPrefix: raw.REDIS_KEY_PREFIX,
    addis: {
      apiKey: raw.ADDIS_AI_API_KEY ?? '',
      baseUrl: raw.ADDIS_AI_BASE_URL.replace(/\/+$/, ''),
      transcribeTimeoutMs: raw.ADDIS_TRANSCRIBE_TIMEOUT_MS,
      planTimeoutMs: raw.ADDIS_PLAN_TIMEOUT_MS,
      breakerFailureThreshold: raw.ADDIS_BREAKER_FAILURE_THRESHOLD,
      breakerResetMs: raw.ADDIS_BREAKER_RESET_MS,
      confidenceFloor: raw.ADDIS_CONFIDENCE_FLOOR,
      avgLogprobFloor: raw.ADDIS_AVG_LOGPROB_FLOOR,
      noSpeechProbMax: raw.ADDIS_NO_SPEECH_PROB_MAX,
      compressionRatioMax: raw.ADDIS_COMPRESSION_RATIO_MAX,
      unavailableConfidencePolicy: raw.ADDIS_UNAVAILABLE_CONFIDENCE_POLICY,
      sttVocabularyField: raw.ADDIS_STT_VOCABULARY_FIELD,
    },
    auth: {
      tokenSecret: raw.AUTH_TOKEN_SECRET,
      sessionTtlSeconds: raw.AUTH_SESSION_TTL_SECONDS,
      refreshGraceSeconds: raw.AUTH_REFRESH_GRACE_SECONDS,
      adminSessionTtlSeconds: raw.ADMIN_SESSION_TTL_SECONDS,
    },
    rateLimit: {
      windowSeconds: raw.RATE_LIMIT_WINDOW_SECONDS,
      ipMax: raw.RATE_LIMIT_IP_MAX,
      authMax: raw.RATE_LIMIT_AUTH_MAX,
      userMax: raw.RATE_LIMIT_USER_MAX,
      commandsMax: raw.RATE_LIMIT_COMMANDS_MAX,
    },
    idempotency: {
      ttlSeconds: raw.IDEMPOTENCY_TTL_SECONDS,
      lockSeconds: raw.IDEMPOTENCY_LOCK_SECONDS,
      waitMs: raw.IDEMPOTENCY_WAIT_MS,
    },
    corsOrigins: origins,
    bodyLimits: { jsonBytes: raw.JSON_BODY_LIMIT_BYTES, commandBytes: raw.COMMAND_BODY_LIMIT_BYTES },
    billing: {
      mode: raw.BILLING_MODE ?? 'disabled',
      provider: raw.BILLING_PROVIDER,
      checkTimeoutMs: raw.BILLING_CHECK_TIMEOUT_MS,
    },
    storage: { driver: storageDriver, localDir: raw.STORAGE_LOCAL_DIR },
    worker: {
      enabled: raw.WORKER_ENABLED,
      pollIntervalMs: raw.WORKER_POLL_INTERVAL_MS,
      deletionMaxAttempts: raw.DELETION_JOB_MAX_ATTEMPTS,
      telemetryBufferMax: raw.TELEMETRY_BUFFER_MAX,
    },
  };
}
