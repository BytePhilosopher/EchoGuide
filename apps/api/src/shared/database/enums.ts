// Closed sets shared by the Drizzle schema (as CHECK constraints) and the modules that use them.
// Changing one of these needs a migration that rewrites the matching constraint.

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'inactive'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Permission rows, not roles. From docs: architecture/security and architecture/other-clients.
export const ADMIN_PERMISSIONS = [
  'users.read',
  'users.suspend',
  'consent.read',
  'consent.revoke',
  'telemetry.read',
  'telemetry.export',
  'billing.refund',
  'admin.manage',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_STATUSES = ['active', 'disabled'] as const;

export const AUDIT_ACTOR_TYPES = ['admin', 'user', 'system'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_OUTCOMES = ['success', 'denied', 'not_found', 'conflict', 'failed'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export const DELETION_JOB_TYPES = ['user_data'] as const;
export const DELETION_JOB_STATUSES = ['queued', 'running', 'retrying', 'completed', 'failed'] as const;
export type DeletionJobStatus = (typeof DELETION_JOB_STATUSES)[number];
export const ACTIVE_DELETION_JOB_STATUSES = ['queued', 'running', 'retrying'] as const;

export const VOCABULARY_KINDS = ['contact', 'app', 'custom'] as const;
export type VocabularyKind = (typeof VOCABULARY_KINDS)[number];

export function sqlList(values: readonly string[]): string {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
}
