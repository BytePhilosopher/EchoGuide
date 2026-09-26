import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AddisAIAdapter, createAddisBreaker } from '../../shared/adapters/addis_ai_adapter';
import { evaluateConfidence } from '../../modules/commands/confidence-gate';
import { loadEntryAudio } from './audio';
import { GoldenManifestSchema } from './manifest.schema';
import { corpusWer } from './wer';

/**
 * Live mode: approved recordings against the real Addis AI endpoint. Opt-in only, because it needs
 * a vendor key, network access and recordings that are never committed. Without them it skips and
 * says why, rather than passing silently.
 */
const live = process.env.GOLDEN_AUDIO_LIVE === '1';
const apiKey = process.env.ADDIS_AI_API_KEY ?? '';
const maxWer = Number(process.env.GOLDEN_AUDIO_MAX_WER ?? 0.03);
const root = __dirname;

describe('golden audio corpus (live mode)', () => {
  test('approved recordings meet the word-error-rate claim against the real provider', async (t) => {
    if (!live) return t.skip('set GOLDEN_AUDIO_LIVE=1 to run against the real provider');
    if (!apiKey) return t.skip('ADDIS_AI_API_KEY is not set');
    const manifest = GoldenManifestSchema.parse(JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')));
    const recordings = manifest.entries.filter((entry) => entry.source === 'approved-recording');
    const available: Array<{ entry: (typeof recordings)[number]; pcm: Buffer }> = [];
    for (const entry of recordings) {
      const pcm = await loadEntryAudio(entry, root);
      if (pcm) available.push({ entry, pcm });
    }
    if (available.length === 0) return t.skip('no approved recordings are present in src/test/golden/recordings/');

    const adapter = new AddisAIAdapter({
      apiKey,
      baseUrl: process.env.ADDIS_AI_BASE_URL ?? 'https://api.addisassistant.com',
      transcribeTimeoutMs: 8000,
      planTimeoutMs: 6000,
      breaker: createAddisBreaker(1000, 1),
    });
    const pairs: Array<{ reference: string; hypothesis: string }> = [];
    const shapes: Record<string, number> = {};
    for (const { entry, pcm } of available) {
      const result = await adapter.transcribeAudio(pcm, entry.language);
      shapes[result.metadata.shape] = (shapes[result.metadata.shape] ?? 0) + 1;
      const verdict = evaluateConfidence(result, {
        confidenceFloor: 0.6,
        avgLogprobFloor: -1.0,
        noSpeechProbMax: 0.6,
        compressionRatioMax: 2.4,
        unavailablePolicy: 'confirm',
      });
      t.diagnostic(`${entry.id}: gate=${verdict.outcome} shape=${result.metadata.shape} mismatches=${result.metadata.mismatches.join(',') || 'none'}`);
      pairs.push({ reference: entry.expected_transcript ?? '', hypothesis: result.transcript });
    }
    const wer = corpusWer(pairs);
    t.diagnostic(`corpus WER ${(wer * 100).toFixed(2)}% over ${pairs.length} recordings; response shapes ${JSON.stringify(shapes)}`);
    assert.ok(wer <= maxWer, `corpus WER ${(wer * 100).toFixed(2)}% exceeds ${(maxWer * 100).toFixed(2)}%`);
  });
});
