import { deleteUserCascade, findLatestGrant, insertGrant } from './consent.repository';

export const AUDIO_RETENTION_SCOPE = 'audio_retention';

export type ConsentState = {
  scope: string;
  granted: boolean;
  created_at: string | null;
};

export async function recordGrant(
  userId: string,
  scope: string,
  granted: boolean,
): Promise<{ status: 'recorded'; scope: string; granted: boolean }> {
  const row = await insertGrant(userId, scope, granted);
  return { status: 'recorded', scope, granted: row?.granted ?? granted };
}

export async function getCurrentConsent(userId: string, scope: string): Promise<ConsentState> {
  const row = await findLatestGrant(userId, scope);
  return {
    scope,
    granted: row?.granted === true,
    created_at: row?.createdAt.toISOString() ?? null,
  };
}

export async function isGranted(userId: string, scope: string): Promise<boolean> {
  const current = await getCurrentConsent(userId, scope);
  return current.granted;
}

export async function withRetention<T>(
  userId: string,
  scope: string,
  write: () => Promise<T>,
): Promise<T | null> {
  if (!(await isGranted(userId, scope))) return null;
  return write();
}

export async function requestDeletion(userId: string): Promise<{ status: 'deletion_queued'; task_id: string }> {
  await deleteUserCascade(userId);
  return { status: 'deletion_queued', task_id: `del-job-${Date.now()}` };
}
