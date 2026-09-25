import { createHash, randomUUID } from 'node:crypto';
import { findUserIdByInstallId, registerDevice } from './auth.repository';

export async function resolveUserIdByInstallId(installId: string): Promise<string | null> {
  return findUserIdByInstallId(installId);
}

export async function registerInstall(input: {
  installId: string;
  phoneHash?: string;
  model?: string;
  locale?: string;
}): Promise<string | null> {
  return registerDevice({
    installId: input.installId,
    phoneHash: input.phoneHash ?? anonymousHash(input.installId),
    model: input.model ?? 'unknown',
    locale: input.locale === 'en-US' ? 'en-US' : 'am-ET',
  });
}

export function newInstallId(): string {
  return randomUUID();
}

function anonymousHash(installId: string): string {
  return createHash('sha256').update(`install:${installId}`).digest('hex');
}
