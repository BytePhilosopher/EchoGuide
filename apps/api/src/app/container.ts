import type Redis from 'ioredis';
import type { Pool } from 'pg';
import { AddisAIAdapter, createAddisBreaker, type PlanningPort, type TranscriptionPort } from '../shared/adapters/addis_ai_adapter';
import type { AppConfig } from '../shared/config';
import { createDatabase, type Database } from '../shared/database/client';
import { IdempotencyStore } from '../shared/idempotency/idempotency';
import { createRedis, RedisKeys } from '../shared/redis/client';
import { RateLimiter } from '../shared/security/rate-limit';
import { createStorage, type StorageService } from '../shared/storage/storage.service';
import { AdminAuthService } from '../modules/admin/admin.auth';
import { AdminService } from '../modules/admin/admin.service';
import { AuditService } from '../modules/admin/audit.service';
import { AuthRepository } from '../modules/auth/auth.repository';
import { AuthService } from '../modules/auth/auth.service';
import { BillingRepository } from '../modules/billing/billing.repository';
import { BillingService } from '../modules/billing/billing.service';
import { NoPaymentProvider, type PaymentProvider } from '../modules/billing/payment-provider';
import { SubscriptionService } from '../modules/billing/subscription.service';
import { AppGrantsRepository } from '../modules/commands/app-grants.repository';
import { AppGrantsService } from '../modules/commands/app-grants.service';
import { CommandPipeline } from '../modules/commands/commands.service';
import { ConsentRepository } from '../modules/consent/consent.repository';
import { ConsentService } from '../modules/consent/consent.service';
import { DeletionService } from '../modules/consent/deletion.service';
import { TelemetryRepository } from '../modules/telemetry/telemetry.repository';
import { TelemetryService } from '../modules/telemetry/telemetry.service';
import { UsersService } from '../modules/users/users.service';
import { VocabularyService } from '../modules/vocabulary/vocabulary.service';

export type Container = {
  config: AppConfig;
  db: Database;
  pool: Pool;
  redis: Redis;
  keys: RedisKeys;
  storage: StorageService;
  addis: AddisAIAdapter;
  rateLimiter: RateLimiter;
  idempotency: IdempotencyStore;
  auth: AuthService;
  users: UsersService;
  audit: AuditService;
  adminAuth: AdminAuthService;
  admin: AdminService;
  consent: ConsentService;
  deletion: DeletionService;
  grants: AppGrantsService;
  telemetry: TelemetryService;
  billing: BillingService;
  vocabulary: VocabularyService;
  pipeline: CommandPipeline;
  close(): Promise<void>;
};

export type ContainerOverrides = {
  storage?: StorageService;
  paymentProvider?: PaymentProvider;
  transcriber?: TranscriptionPort;
  planner?: PlanningPort;
};

/** Builds every service from configuration. The only place infrastructure is instantiated. */
export function createContainer(config: AppConfig, overrides: ContainerOverrides = {}): Container {
  const { db, pool } = createDatabase(config.databaseUrl, config.databasePoolMax);
  const redis = createRedis(config.redisUrl);
  const keys = new RedisKeys(config.redisKeyPrefix);
  const storage = overrides.storage ?? createStorage(config.storage);
  const addis = new AddisAIAdapter({
    apiKey: config.addis.apiKey,
    baseUrl: config.addis.baseUrl,
    transcribeTimeoutMs: config.addis.transcribeTimeoutMs,
    planTimeoutMs: config.addis.planTimeoutMs,
    breaker: createAddisBreaker(config.addis.breakerFailureThreshold, config.addis.breakerResetMs),
    sttVocabularyField: config.addis.sttVocabularyField,
  });

  const audit = new AuditService(db);
  const telemetry = new TelemetryService(redis, keys, new TelemetryRepository(db), config.worker.telemetryBufferMax);
  const grants = new AppGrantsService(new AppGrantsRepository(db));
  const vocabulary = new VocabularyService(db);
  const billing = new BillingService(
    config.billing.mode,
    new SubscriptionService(new BillingRepository(db), overrides.paymentProvider ?? new NoPaymentProvider(), config.billing.checkTimeoutMs),
  );

  return {
    config,
    db,
    pool,
    redis,
    keys,
    storage,
    addis,
    rateLimiter: new RateLimiter(redis, keys, config.rateLimit.windowSeconds),
    idempotency: new IdempotencyStore(redis, keys, config.idempotency),
    auth: new AuthService(new AuthRepository(db), config.auth),
    users: new UsersService(db),
    audit,
    adminAuth: new AdminAuthService(db, config.auth.tokenSecret, config.auth.adminSessionTtlSeconds),
    admin: new AdminService(db, audit),
    consent: new ConsentService(new ConsentRepository(db)),
    deletion: new DeletionService(db, redis, keys, storage, audit, config.worker.deletionMaxAttempts),
    grants,
    telemetry,
    billing,
    vocabulary,
    pipeline: new CommandPipeline({
      transcriber: overrides.transcriber ?? addis,
      planner: overrides.planner ?? addis,
      billing,
      grants,
      vocabulary,
      telemetry,
      thresholds: {
        confidenceFloor: config.addis.confidenceFloor,
        avgLogprobFloor: config.addis.avgLogprobFloor,
        noSpeechProbMax: config.addis.noSpeechProbMax,
        compressionRatioMax: config.addis.compressionRatioMax,
        unavailablePolicy: config.addis.unavailableConfidencePolicy,
      },
      sendVocabulary: Boolean(config.addis.sttVocabularyField),
    }),
    async close() {
      redis.disconnect();
      await pool.end();
    },
  };
}
