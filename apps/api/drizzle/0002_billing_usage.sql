ALTER TABLE "subscriptions" ADD COLUMN "command_quota" integer DEFAULT 10000 NOT NULL;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "commands_used" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('active', 'past_due', 'canceled', 'inactive'));
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_quota_check" CHECK ("subscriptions"."command_quota" >= 0);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_used_check" CHECK ("subscriptions"."commands_used" >= 0);
