-- Section 9 Data Architecture & Schema Definition
-- Source of truth: Postgres. Redis holds cache & rate limits only.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (§9 Identity & Access)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_hash TEXT UNIQUE NOT NULL,
    locale VARCHAR(10) NOT NULL DEFAULT 'am-ET',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Devices bound to user (§9 Identity)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    install_id TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opaque server-side sessions bound to install_id (§10.4 Auth)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- User Preferences (§9)
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'am-ET',
    speech_rate INT NOT NULL DEFAULT 100,
    wake_word TEXT NOT NULL DEFAULT 'Echo'
);

-- Append-only consent grants (§9.3 Audit Trail)
CREATE TABLE consent_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    granted BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Command events telemetry (§9.1 Event table detail)
-- CRITICAL PRIVACY RULE: NO transcript column, NO audio reference.
CREATE TABLE command_events (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('done', 'failed', 'rejected', 'blocked', 'cancelled')),
    duration_ms INT NOT NULL,
    confidence REAL,
    stage_timings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Initial monthly partition (§9.2 Growth and retention)
CREATE TABLE command_events_y2026m09 PARTITION OF command_events
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

-- Telemetry performance indexes (§9.1)
CREATE INDEX command_events_user_created_idx ON command_events (user_id, created_at DESC);
CREATE INDEX command_events_created_idx ON command_events (created_at);
CREATE INDEX command_events_outcome_idx ON command_events (outcome, created_at);

-- Subscriptions (§9)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    renews_at TIMESTAMPTZ NOT NULL
);
