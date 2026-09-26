CREATE TABLE "admin_permissions" (
	"admin_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_permissions_admin_id_permission_pk" PRIMARY KEY("admin_id","permission"),
	CONSTRAINT "admin_permissions_permission_check" CHECK ("admin_permissions"."permission" IN ('users.read', 'users.suspend', 'consent.read', 'consent.revoke', 'telemetry.read', 'telemetry.export', 'billing.refund', 'admin.manage'))
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "admin_users_status_check" CHECK ("admin_users"."status" IN ('active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_admin_id" uuid,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"target_user_id" uuid,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_actor_type_check" CHECK ("audit_logs"."actor_type" IN ('admin', 'user', 'system')),
	CONSTRAINT "audit_logs_outcome_check" CHECK ("audit_logs"."outcome" IN ('success', 'denied', 'not_found', 'conflict', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "deletion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text DEFAULT 'user_data' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "deletion_jobs_type_check" CHECK ("deletion_jobs"."type" IN ('user_data')),
	CONSTRAINT "deletion_jobs_status_check" CHECK ("deletion_jobs"."status" IN ('queued', 'running', 'retrying', 'completed', 'failed')),
	CONSTRAINT "deletion_jobs_attempts_check" CHECK ("deletion_jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vocabulary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"term" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocabulary_terms_kind_check" CHECK ("vocabulary_terms"."kind" IN ('contact', 'app', 'custom')),
	CONSTRAINT "vocabulary_terms_term_length_check" CHECK (char_length("vocabulary_terms"."term") BETWEEN 1 AND 64)
);
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_status_check";--> statement-breakpoint
DROP INDEX "subscriptions_user_id_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_terms" ADD CONSTRAINT "vocabulary_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "audit_logs_target_created_idx" ON "audit_logs" USING btree ("target_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_admin_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_idx" ON "audit_logs" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_jobs_active_user_unique" ON "deletion_jobs" USING btree ("user_id") WHERE status IN ('queued', 'running', 'retrying');--> statement-breakpoint
CREATE INDEX "deletion_jobs_claim_idx" ON "deletion_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "deletion_jobs_user_id_idx" ON "deletion_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vocabulary_terms_user_term_unique" ON "vocabulary_terms" USING btree ("user_id",lower("term"));--> statement-breakpoint
CREATE INDEX "vocabulary_terms_user_created_idx" ON "vocabulary_terms" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user_renews_idx" ON "subscriptions" USING btree ("user_id","renews_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('active', 'trialing', 'past_due', 'canceled', 'inactive'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("users"."status" IN ('active', 'suspended'));