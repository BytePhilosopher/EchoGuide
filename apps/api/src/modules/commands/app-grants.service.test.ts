import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPackageGranted, type AppGrantLookup } from './app-grants.service';

const USER = '00000000-0000-4000-8000-000000000001';
const PKG = 'com.whatsapp';

const lookupReturning = (row: { granted: boolean } | null): AppGrantLookup => async () => row;

test('granted when the latest row grants the app', async () => {
  assert.equal(await isPackageGranted(USER, PKG, lookupReturning({ granted: true })), true);
});

test('not granted when the latest row revokes the app', async () => {
  assert.equal(await isPackageGranted(USER, PKG, lookupReturning({ granted: false })), false);
});

test('not granted when the user never decided', async () => {
  assert.equal(await isPackageGranted(USER, PKG, lookupReturning(null)), false);
});

test('not granted for an unknown user, without querying', async () => {
  let queried = false;
  const lookup: AppGrantLookup = async () => {
    queried = true;
    return { granted: true };
  };
  assert.equal(await isPackageGranted(undefined, PKG, lookup), false);
  assert.equal(queried, false);
});

test('not granted for an empty package name', async () => {
  assert.equal(await isPackageGranted(USER, '', lookupReturning({ granted: true })), false);
});

test('lookup is scoped to the exact user and package', async () => {
  const seen: Array<[string, string]> = [];
  const lookup: AppGrantLookup = async (userId, packageName) => {
    seen.push([userId, packageName]);
    return { granted: true };
  };
  await isPackageGranted(USER, 'com.chase.mobile', lookup);
  assert.deepEqual(seen, [[USER, 'com.chase.mobile']]);
});
