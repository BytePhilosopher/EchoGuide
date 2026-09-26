import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  ACTIVE_DELETION_JOB_STATUSES,
  ADMIN_PERMISSIONS,
  ADMIN_STATUSES,
  AUDIT_ACTOR_TYPES,
  AUDIT_OUTCOMES,
  DELETION_JOB_STATUSES,
  DELETION_JOB_TYPES,
  SUBSCRIPTION_STATUSES,
  USER_STATUSES,
  VOCABULARY_KINDS,
  sqlList,
} from './enums';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const inList = (values: readonly string[]) => sql.raw(`(${sqlList(values)})`);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Only a verified phone number may link installs to one account. There is no verification
    // provider yet, so registration leaves this null rather than trusting a client claim.
    phoneHash: text('phone_hash').unique(),
    locale: text('locale').notNull().default('am-ET'),
    status: text('status').notNull().default('active'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    createdAt: createdAt(),
    // Set when deletion is requested. The row itself is removed by the deletion job.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('users_locale_check', sql`${t.locale} IN ('am-ET', 'en-US')`),
    check('users_status_check', sql`${t.status} IN ${inList(USER_STATUSES)}`),
  ],
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    installId: text('install_id').notNull().unique(),
    model: text('model').notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('devices_user_id_idx').on(t.userId)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    // HMAC-SHA256 of the opaque token. The token itself is never stored.
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('sessions_device_id_idx').on(t.deviceId)],
);

export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    language: text('language').notNull().default('am-ET'),
    speechRate: integer('speech_rate').notNull().default(100),
    wakeWord: text('wake_word').notNull().default('Echo'),
  },
  (t) => [
    check('user_preferences_language_check', sql`${t.language} IN ('am-ET', 'en-US')`),
    check('user_preferences_speech_rate_check', sql`${t.speechRate} > 0`),
  ],
);

export const consentGrants = pgTable(
  'consent_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    granted: boolean('granted').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('consent_grants_current_idx').on(t.userId, t.scope, t.createdAt.desc())],
);

export const appGrants = pgTable(
  'app_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    packageName: text('package_name').notNull(),
    granted: boolean('granted').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('app_grants_current_idx').on(t.userId, t.packageName, t.createdAt.desc())],
);

export const commandEvents = pgTable(
  'command_events',
  {
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    outcome: text('outcome').notNull(),
    durationMs: integer('duration_ms').notNull(),
    confidence: real('confidence'),
    stageTimings: jsonb('stage_timings').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.createdAt] }),
    check(
      'command_events_outcome_check',
      sql`${t.outcome} IN ('done', 'failed', 'rejected', 'blocked', 'cancelled')`,
    ),
    check('command_events_duration_check', sql`${t.durationMs} >= 0`),
    index('command_events_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('command_events_created_idx').on(t.createdAt),
    index('command_events_outcome_idx').on(t.outcome, t.createdAt),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    renewsAt: timestamp('renews_at', { withTimezone: true }).notNull(),
    commandQuota: integer('command_quota').notNull().default(10000),
    commandsUsed: integer('commands_used').notNull().default(0),
  },
  (t) => [
    index('subscriptions_user_renews_idx').on(t.userId, t.renewsAt.desc()),
    check('subscriptions_status_check', sql`${t.status} IN ${inList(SUBSCRIPTION_STATUSES)}`),
    check('subscriptions_quota_check', sql`${t.commandQuota} >= 0`),
    check('subscriptions_used_check', sql`${t.commandsUsed} >= 0`),
  ],
);

// Admins are not users with a flag: separate table, separate credential, permission rows.
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('admin_users_email_unique').on(sql`lower(${t.email})`),
    check('admin_users_status_check', sql`${t.status} IN ${inList(ADMIN_STATUSES)}`),
  ],
);

export const adminPermissions = pgTable(
  'admin_permissions',
  {
    adminId: uuid('admin_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.adminId, t.permission] }),
    check('admin_permissions_permission_check', sql`${t.permission} IN ${inList(ADMIN_PERMISSIONS)}`),
  ],
);

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('admin_sessions_admin_id_idx').on(t.adminId)],
);

// Audit rows outlive the user they describe, so target_user_id is deliberately not a foreign key.
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorType: text('actor_type').notNull(),
    actorAdminId: uuid('actor_admin_id').references(() => adminUsers.id),
    action: text('action').notNull(),
    outcome: text('outcome').notNull(),
    targetUserId: uuid('target_user_id'),
    requestId: text('request_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    check('audit_logs_actor_type_check', sql`${t.actorType} IN ${inList(AUDIT_ACTOR_TYPES)}`),
    check('audit_logs_outcome_check', sql`${t.outcome} IN ${inList(AUDIT_OUTCOMES)}`),
    index('audit_logs_target_created_idx').on(t.targetUserId, t.createdAt.desc()),
    index('audit_logs_actor_created_idx').on(t.actorAdminId, t.createdAt.desc()),
    index('audit_logs_action_created_idx').on(t.action, t.createdAt.desc()),
  ],
);

// The job must outlive the user row it deletes, so user_id is deliberately not a foreign key.
export const deletionJobs = pgTable(
  'deletion_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    type: text('type').notNull().default('user_data'),
    status: text('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: createdAt(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (t) => [
    check('deletion_jobs_type_check', sql`${t.type} IN ${inList(DELETION_JOB_TYPES)}`),
    check('deletion_jobs_status_check', sql`${t.status} IN ${inList(DELETION_JOB_STATUSES)}`),
    check('deletion_jobs_attempts_check', sql`${t.attempts} >= 0`),
    uniqueIndex('deletion_jobs_active_user_unique')
      .on(t.userId)
      .where(sql`status IN ${inList(ACTIVE_DELETION_JOB_STATUSES)}`),
    index('deletion_jobs_claim_idx').on(t.status, t.nextAttemptAt),
    index('deletion_jobs_user_id_idx').on(t.userId),
  ],
);

export const vocabularyTerms = pgTable(
  'vocabulary_terms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    term: text('term').notNull(),
    kind: text('kind').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('vocabulary_terms_kind_check', sql`${t.kind} IN ${inList(VOCABULARY_KINDS)}`),
    check('vocabulary_terms_term_length_check', sql`char_length(${t.term}) BETWEEN 1 AND 64`),
    uniqueIndex('vocabulary_terms_user_term_unique').on(t.userId, sql`lower(${t.term})`),
    index('vocabulary_terms_user_created_idx').on(t.userId, t.createdAt),
  ],
);
