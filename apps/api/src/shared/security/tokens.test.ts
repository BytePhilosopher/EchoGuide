import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, hashToken, isWellFormedToken, parseBearer } from './tokens';

describe('tokens', () => {
  test('tokens carry 256 bits of randomness and an audience prefix', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateToken('session')));
    assert.equal(tokens.size, 1000);
    for (const token of tokens) assert.match(token, /^egs_[A-Za-z0-9_-]{43}$/);
    assert.match(generateToken('admin'), /^ega_[A-Za-z0-9_-]{43}$/);
  });

  test('a session token is not a well-formed admin token and vice versa', () => {
    assert.equal(isWellFormedToken('admin', generateToken('session')), false);
    assert.equal(isWellFormedToken('session', generateToken('admin')), false);
  });

  test('hashing is keyed: the same token hashes differently under another secret', () => {
    const token = generateToken('session');
    assert.equal(hashToken('a'.repeat(32), token), hashToken('a'.repeat(32), token));
    assert.notEqual(hashToken('a'.repeat(32), token), hashToken('b'.repeat(32), token));
    assert.notEqual(hashToken('a'.repeat(32), token), token);
  });

  test('parseBearer accepts exactly "Bearer <token>"', () => {
    const token = generateToken('session');
    assert.equal(parseBearer(`Bearer ${token}`, 'session'), token);
    for (const header of [undefined, '', token, `bearer ${token}`, `Bearer  ${token}`, `Bearer ${token} `, `Basic ${token}`, `Bearer ${token.slice(0, -2)}`, `Bearer ${'x'.repeat(300)}`]) {
      assert.equal(parseBearer(header, 'session'), null, String(header).slice(0, 30));
    }
  });
});
