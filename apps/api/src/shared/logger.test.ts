import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { runWithScope } from './context';
import { describeError, logStructured, setLogSink } from './logger';

let lines: string[] = [];
let restore: ReturnType<typeof setLogSink>;
beforeEach(() => {
  lines = [];
  restore = setLogSink((line) => lines.push(line));
});
afterEach(() => {
  setLogSink(restore);
});

describe('logStructured', () => {
  test('drops speech fields', () => {
    logStructured('x', { transcript: 'hello', audio_base64: 'AAAA', stt_text: 'hi', term: 'Abebe', payload: 'send', outcome: 'done' });
    assert.deepEqual(JSON.parse(lines[0]), { event: 'x', outcome: 'done' });
  });

  test('drops the whole line when a user id and speech appear together', () => {
    logStructured('x', { user_id: 'u1', transcript: 'hello' });
    assert.equal(lines.length, 0);
  });

  test('never logs credentials or phone hashes', () => {
    logStructured('x', {
      session_token: 'egs_abc',
      authorization: 'Bearer egs_abc',
      api_key: 'k',
      'x-api-key': 'k',
      AUTH_TOKEN_SECRET: 's',
      phone_hash: 'ph',
      password: 'p',
      cookie: 'c',
      status: 401,
    });
    assert.deepEqual(JSON.parse(lines[0]), { event: 'x', status: 401 });
  });

  test('adds the request and trace id from the request scope', () => {
    runWithScope({ requestId: 'r-1', traceId: 't1' }, () => logStructured('x'));
    assert.deepEqual(JSON.parse(lines[0]), { event: 'x', request_id: 'r-1', trace_id: 't1' });
  });
});

describe('describeError', () => {
  test('keeps the class and code, never the message', () => {
    const pgError = Object.assign(new Error('duplicate key value violates unique constraint "users_phone_hash_unique" Key (phone_hash)=(abc)'), {
      code: '23505',
    });
    const described = describeError(pgError);
    assert.deepEqual(described, { error_name: 'Error', error_code: '23505' });
    assert.equal(JSON.stringify(described).includes('abc'), false);
  });

  test('unwraps drizzle query errors to the driver error', () => {
    const cause = Object.assign(new Error('secret value'), { code: '23503', name: 'error' });
    const wrapped = Object.assign(new Error('Failed query: insert ... params: secret'), { name: 'DrizzleQueryError', cause });
    assert.deepEqual(describeError(wrapped), { error_name: 'error', error_code: '23503' });
  });
});
