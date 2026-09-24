import { findUserIdByInstallId } from './auth.repository';

export async function resolveUserIdByInstallId(installId: string): Promise<string | null> {
  return findUserIdByInstallId(installId);
}
