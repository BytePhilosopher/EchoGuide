DROP TABLE IF EXISTS "vocabulary_terms";
DROP TABLE IF EXISTS "deletion_jobs";
DROP TABLE IF EXISTS "audit_logs";
DROP TABLE IF EXISTS "admin_sessions";
DROP TABLE IF EXISTS "admin_permissions";
DROP TABLE IF EXISTS "admin_users";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_status_check";
ALTER TABLE "users" DROP COLUMN IF EXISTS "suspended_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "status";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "revoked_at";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "created_at";
ALTER TABLE "devices" DROP COLUMN IF EXISTS "created_at";

-- Restoring NOT NULL fails if a user registered without a phone hash after this migration.
-- Those rows have no identity to restore, so rolling back requires deleting them first.
ALTER TABLE "users" ALTER COLUMN "phone_hash" SET NOT NULL;

DROP INDEX IF EXISTS "subscriptions_user_renews_idx";
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_status_check";
-- Fails if any subscription is 'trialing'; those rows must be migrated before rolling back.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('active', 'past_due', 'canceled', 'inactive'));
