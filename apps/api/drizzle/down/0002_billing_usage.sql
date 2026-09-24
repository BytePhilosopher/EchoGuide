ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_used_check";
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_quota_check";
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_status_check";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "commands_used";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "command_quota";
