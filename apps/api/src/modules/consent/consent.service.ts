import { ConsentRepository } from './consent.repository';

export const AUDIO_RETENTION_SCOPE = 'audio_retention';

export type ConsentState = {
  scope: string;
  granted: boolean;
  created_at: string | null;
};

export class ConsentService {
  constructor(private readonly repo: ConsentRepository) {}

  async recordGrant(userId: string, scope: string, granted: boolean): Promise<{ status: 'recorded'; scope: string; granted: boolean }> {
    const row = await this.repo.insertGrant(userId, scope, granted);
    return { status: 'recorded', scope: row.scope, granted: row.granted };
  }

  async getCurrentConsent(userId: string, scope: string): Promise<ConsentState> {
    const row = await this.repo.findLatestGrant(userId, scope);
    return {
      scope,
      granted: row?.granted === true,
      created_at: row?.createdAt.toISOString() ?? null,
    };
  }

  async isGranted(userId: string, scope: string): Promise<boolean> {
    return (await this.getCurrentConsent(userId, scope)).granted;
  }

  /** Runs a retention write only while the user's consent for the scope is current. */
  async withRetention<T>(userId: string, scope: string, write: () => Promise<T>): Promise<T | null> {
    if (!(await this.isGranted(userId, scope))) return null;
    return write();
  }
}
