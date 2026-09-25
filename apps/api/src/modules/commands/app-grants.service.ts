import { findLatestAppGrant, insertAppGrant, listLatestAppGrants } from './app-grants.repository';

export type AppGrantState = {
  package_name: string;
  granted: boolean;
  created_at: string;
};

export type AppGrantLookup = (
  userId: string,
  packageName: string,
) => Promise<{ granted: boolean } | null>;

export async function recordAppGrant(
  userId: string,
  packageName: string,
  granted: boolean,
): Promise<{ status: 'recorded'; package_name: string; granted: boolean }> {
  const row = await insertAppGrant(userId, packageName, granted);
  return { status: 'recorded', package_name: packageName, granted: row?.granted ?? granted };
}

export async function listAppGrants(userId: string): Promise<AppGrantState[]> {
  const rows = await listLatestAppGrants(userId);
  return rows.map((row) => ({
    package_name: row.packageName,
    granted: row.granted,
    created_at: row.createdAt.toISOString(),
  }));
}

// Fails closed, unlike billing: an unknown user, a missing row or no database all mean "not granted".
export async function isPackageGranted(
  userId: string | undefined,
  packageName: string,
  lookup: AppGrantLookup = findLatestAppGrant,
): Promise<boolean> {
  if (!userId || !packageName) return false;
  const row = await lookup(userId, packageName);
  return row?.granted === true;
}
