import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEntryAudio } from '../golden/audio';
import { GoldenManifestSchema } from '../golden/manifest.schema';
import { addisFixture } from '../fixtures/addis';
import { plannerReply, startHarness, type Harness, type TestUser } from '../harness';

const GOLDEN_ROOT = join(__dirname, '../golden');
const manifest = GoldenManifestSchema.parse(JSON.parse(readFileSync(join(GOLDEN_ROOT, 'manifest.json'), 'utf8')));

/** Finds the uploaded WAV inside the multipart body and reads its header. */
function uploadedWav(body: Buffer) {
  const start = body.indexOf('RIFF');
  assert.ok(start >= 0, 'the provider received a WAV');
  return {
    format: body.readUInt16LE(start + 20),
    channels: body.readUInt16LE(start + 22),
    sampleRate: body.readUInt32LE(start + 24),
    bitsPerSample: body.readUInt16LE(start + 34),
    dataBytes: body.readUInt32LE(start + 40),
  };
}

describe('golden audio corpus (replay mode)', () => {
  let h: Harness;
  let user: TestUser;
  before(async () => {
    h = await startHarness();
    user = await h.registerUser();
    await h.fetch('/v1/app-grants', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...user.headers },
      body: JSON.stringify({ package_name: 'com.whatsapp', granted: true }),
    });
  });
  after(async () => {
    await h.close();
  });

  test('the manifest is valid and contains no human speech in the repository', () => {
    assert.ok(manifest.entries.length > 0);
    for (const entry of manifest.entries) {
      if (entry.source === 'approved-recording') assert.equal(entry.audio.kind, 'recording');
    }
  });

  for (const entry of manifest.entries) {
    test(`${entry.id}: ${entry.expected.gate} → HTTP ${entry.expected.http_status}${entry.expected.status ? ` ${entry.expected.status}` : ''}`, async (t) => {
      const pcm = await loadEntryAudio(entry, GOLDEN_ROOT);
      if (!pcm) {
        t.skip(`recording ${entry.audio.kind === 'recording' ? entry.audio.path : ''} is not present (approved recordings are distributed out of band)`);
        return;
      }
      h.addis.reset();
      h.c.addis.breaker.reset();
      if (entry.provider_fixture) {
        const fixture = addisFixture(entry.provider_fixture);
        h.addis.stt = () => ({ body: fixture });
      }
      h.addis.plan = plannerReply({ package_name: 'com.whatsapp', requires_user_confirmation: false, steps: [{ action_type: 'TAP', target_node_id: 'n1', is_destructive: false }] });

      const requestId = randomUUID();
      const res = await h.json<Record<string, unknown>>('/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': randomUUID(), 'x-request-id': requestId, ...user.headers },
        body: JSON.stringify({
          audio_base64: pcm.toString('base64'),
          duration_ms: Math.min(15_000, Math.max(400, Math.round(pcm.length / 32))),
          language: entry.language,
          screen_context: { current_package: 'com.whatsapp', view_tree_summary: 'n1 Chats' },
        }),
      });

      assert.equal(res.status, entry.expected.http_status);
      if (entry.expected.status) assert.equal(res.body.status, entry.expected.status);

      if (entry.expected.gate === 'NOT_SENT') {
        assert.equal(h.addis.callsTo('/api/v2/stt'), 0);
        return;
      }

      const upload = h.addis.calls.find((call) => call.path === '/api/v2/stt');
      assert.ok(upload);
      assert.deepEqual(uploadedWav(upload.body), { format: 1, channels: 1, sampleRate: 16_000, bitsPerSample: 16, dataBytes: pcm.length });
      assert.match(upload.body.toString('latin1'), new RegExp(`"language_code":"${entry.language.startsWith('en') ? 'en' : 'am'}"`));

      const gateLine = h.logs.map((line) => JSON.parse(line) as Record<string, unknown>).find((line) => line.event === 'command.gate' && line.request_id === requestId);
      if (entry.expected.gate === 'INVALID_PROVIDER_RESPONSE') {
        assert.equal(gateLine, undefined, 'an unreadable response never reaches the gate');
      } else {
        assert.equal(gateLine?.outcome, entry.expected.gate);
      }
      const planned = h.addis.callsTo('/api/v1/chat_generate') > 0;
      assert.equal(planned, entry.expected.gate === 'VALIDATED' || entry.expected.gate === 'CONFIDENCE_UNAVAILABLE', 'planning is only spent on transcripts that pass the gate');
    });
  }
});
