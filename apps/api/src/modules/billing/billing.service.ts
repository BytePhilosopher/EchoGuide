import { findLatestSubscription, incrementUsage } from './billing.repository';

export const SPEAK_BILLING_INACTIVE = 'ERR_BILLING';
export const SPEAK_BILLING_QUOTA = 'ERR_BILLING';

export type Entitlement = {
  status: string | null;
  renews_at: string | null;
  command_quota: number | null;
  commands_used: number | null;
};

export type CommandGate =
  | { allowed: true }
  | { allowed: false; reason: 'inactive' | 'quota'; speak_code: string };

const CHECK_TIMEOUT_MS = 100;
const seenIdempotency = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_MAX = 5000;

const FAIL_OPEN: CommandGate = { allowed: true };

function rememberIdempotency(key: string): boolean {
  const now = Date.now();
  const existing = seenIdempotency.get(key);
  if (existing && now - existing < IDEMPOTENCY_TTL_MS) return true;
  if (seenIdempotency.size >= IDEMPOTENCY_MAX) {
    const oldest = seenIdempotency.keys().next().value;
    if (oldest) seenIdempotency.delete(oldest);
  }
  seenIdempotency.set(key, now);
  return false;
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const row = await findLatestSubscription(userId);
  if (!row) {
    return { status: null, renews_at: null, command_quota: null, commands_used: null };
  }
  return {
    status: row.status,
    renews_at: row.renewsAt.toISOString(),
    command_quota: row.commandQuota,
    commands_used: row.commandsUsed,
  };
}

async function evaluateCommand(userId: string, idempotencyKey?: string): Promise<CommandGate> {
  const row = await findLatestSubscription(userId);
  if (!row) return FAIL_OPEN;
  if (row.status !== 'active') {
    return { allowed: false, reason: 'inactive', speak_code: SPEAK_BILLING_INACTIVE };
  }
  if (row.commandsUsed >= row.commandQuota) {
    return { allowed: false, reason: 'quota', speak_code: SPEAK_BILLING_QUOTA };
  }
  if (idempotencyKey && rememberIdempotency(idempotencyKey)) return { allowed: true };
  const updated = await incrementUsage(row.id);
  if (!updated) {
    return { allowed: false, reason: 'quota', speak_code: SPEAK_BILLING_QUOTA };
  }
  return { allowed: true };
}

export async function checkCanRunCommand(userId: string | undefined, idempotencyKey?: string): Promise<CommandGate> {
  if (!userId) return FAIL_OPEN;
  try {
    return await Promise.race([
      evaluateCommand(userId, idempotencyKey),
      new Promise<CommandGate>((resolve) => {
        setTimeout(() => resolve(FAIL_OPEN), CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return FAIL_OPEN;
  }
}
