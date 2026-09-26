import type { AppGrantsRepository } from './app-grants.repository';

export type AppGrantState = {
  package_name: string;
  granted: boolean;
  created_at: string;
};

export type AppGrantLookup = (
  userId: string,
  packageName: string,
) => Promise<{ granted: boolean } | null>;

export class AppGrantsService {
  constructor(private readonly repo: AppGrantsRepository) {}

  async recordAppGrant(
    userId: string,
    packageName: string,
    granted: boolean,
  ): Promise<{ status: 'recorded'; package_name: string; granted: boolean }> {
    const row = await this.repo.insertAppGrant(userId, packageName, granted);
    return { status: 'recorded', package_name: row.packageName, granted: row.granted };
  }

  async listAppGrants(userId: string): Promise<AppGrantState[]> {
    const rows = await this.repo.listLatestAppGrants(userId);
    return rows.map((row) => ({
      package_name: row.packageName,
      granted: row.granted,
      created_at: row.createdAt.toISOString(),
    }));
  }

  isGranted(userId: string | undefined, packageName: string): Promise<boolean> {
    return isPackageGranted(userId, packageName, this.repo.findLatestAppGrant);
  }
}

// Fails closed: an unknown user or a missing row means "not granted".
export async function isPackageGranted(
  userId: string | undefined,
  packageName: string,
  lookup: AppGrantLookup,
): Promise<boolean> {
  if (!userId || !packageName) return false;
  const row = await lookup(userId, packageName);
  return row?.granted === true;
}
