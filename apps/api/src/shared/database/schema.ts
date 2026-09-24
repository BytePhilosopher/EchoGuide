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
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phoneHash: text('phone_hash').notNull().unique(),
    locale: text('locale').notNull().default('am-ET'),
    createdAt: createdAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [check('users_locale_check', sql`${t.locale} IN ('am-ET', 'en-US')`)],
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
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
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
    index('subscriptions_user_id_idx').on(t.userId),
    check(
      'subscriptions_status_check',
      sql`${t.status} IN ('active', 'past_due', 'canceled', 'inactive')`,
    ),
    check('subscriptions_quota_check', sql`${t.commandQuota} >= 0`),
    check('subscriptions_used_check', sql`${t.commandsUsed} >= 0`),
  ],
);
