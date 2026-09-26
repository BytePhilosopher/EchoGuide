import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AddisAIResponseAdapter, type NormalizedTranscription } from '../../shared/adapters/addis_ai_response_adapter';
import { addisFixture } from '../../test/fixtures/addis';
import { evaluateConfidence, type GateThresholds } from './confidence-gate';

const THRESHOLDS: GateThresholds = {
  confidenceFloor: 0.6,
  avgLogprobFloor: -1.0,
  noSpeechProbMax: 0.6,
  compressionRatioMax: 2.4,
  unavailablePolicy: 'confirm',
};

function normalize(fixture: string): NormalizedTranscription {
  const result = AddisAIResponseAdapter.parseTranscription(addisFixture(fixture));
  assert.ok(result.ok, `${fixture} should parse`);
  return result.value;
}

describe('AddisAIResponseAdapter.parseTranscription', () => {
  test('reads a provider score when present', () => {
    const value = normalize('stt-with-confidence');
    assert.equal(value.transcript, 'open chats');
    assert.deepEqual(value.confidence, { kind: 'score', value: 0.93, source: 'provider_confidence' });
    assert.equal(value.metadata.shape, 'confidence_score');
  });

  test('a missing score is "unavailable", never 0', () => {
    const value = normalize('stt-transcript-only');
    assert.deepEqual(value.confidence, { kind: 'unavailable' });
    assert.equal(value.metadata.shape, 'transcript_only');
    assert.deepEqual(value.metadata.mismatches, []);
  });

  test('derives confidence from Whisper-style segments', () => {
    const value = normalize('stt-segments-whisper');
    assert.equal(value.confidence.kind, 'derived');
    if (value.confidence.kind !== 'derived') return;
    assert.ok(Math.abs(value.confidence.avgLogprob - -0.28) < 1e-9);
    assert.ok(Math.abs(value.confidence.value - Math.exp(-0.28)) < 1e-9);
    assert.equal(value.confidence.noSpeechProb, 0.03);
    assert.equal(value.confidence.compressionRatio, 1.2);
  });

  test('reads segments nested under data as well', () => {
    assert.equal(normalize('stt-low-logprob').confidence.kind, 'derived');
  });

  test('an out-of-range score is recorded as a mismatch and treated as unavailable, not rescaled', () => {
    const value = normalize('stt-confidence-out-of-range');
    assert.deepEqual(value.confidence, { kind: 'unavailable' });
    assert.deepEqual(value.metadata.mismatches, ['confidence']);
  });

  test('non-numeric scores and malformed segments are mismatches', () => {
    const a = AddisAIResponseAdapter.parseTranscription({ data: { transcription: 'x' }, confidence: '0.9' });
    assert.ok(a.ok && a.value.confidence.kind === 'unavailable' && a.value.metadata.mismatches[0] === 'confidence');
    const b = AddisAIResponseAdapter.parseTranscription({ data: { transcription: 'x' }, segments: [{ text: 'x' }] });
    assert.ok(b.ok && b.value.confidence.kind === 'unavailable' && b.value.metadata.mismatches[0] === 'segments[0].avg_logprob');
    const c = AddisAIResponseAdapter.parseTranscription({ data: { transcription: 'x' }, confidence: Number.NaN });
    assert.ok(c.ok && c.value.confidence.kind === 'unavailable');
  });

  test('a response without data.transcription is invalid', () => {
    for (const payload of [addisFixture('stt-malformed'), null, 'text', [], { data: { transcription: 42 } }, { data: 'x' }]) {
      const result = AddisAIResponseAdapter.parseTranscription(payload);
      assert.equal(result.ok, false);
    }
  });
});

describe('AddisAIResponseAdapter.parsePlan', () => {
  test('extracts the JSON object from response_text', () => {
    const result = AddisAIResponseAdapter.parsePlan(addisFixture('plan-valid'));
    assert.ok(result.ok);
    assert.equal(result.value.raw.package_name, 'com.whatsapp');
  });

  test('prose, a missing field or a non-object is invalid', () => {
    for (const payload of [addisFixture('plan-not-json'), {}, { response_text: 7 }, { response_text: '[1,2]' }]) {
      assert.equal(AddisAIResponseAdapter.parsePlan(payload).ok, false);
    }
  });
});

describe('evaluateConfidence', () => {
  const t = (transcript: string, confidence: NormalizedTranscription['confidence']): NormalizedTranscription => ({
    transcript,
    confidence,
    metadata: { shape: 'confidence_score', mismatches: [] },
  });

  test('score at or above the floor is validated; below is low confidence', () => {
    assert.equal(evaluateConfidence(t('hi', { kind: 'score', value: 0.6, source: 'provider_confidence' }), THRESHOLDS).outcome, 'VALIDATED');
    assert.equal(evaluateConfidence(t('hi', { kind: 'score', value: 0.95, source: 'provider_confidence' }), THRESHOLDS).outcome, 'VALIDATED');
    assert.equal(evaluateConfidence(t('hi', { kind: 'score', value: 0.59, source: 'provider_confidence' }), THRESHOLDS).outcome, 'LOW_CONFIDENCE');
  });

  test('documented thresholds on derived signals, in the documented direction', () => {
    assert.equal(evaluateConfidence(normalize('stt-segments-whisper'), THRESHOLDS).outcome, 'VALIDATED');
    assert.equal(evaluateConfidence(normalize('stt-low-logprob'), THRESHOLDS).outcome, 'LOW_CONFIDENCE');
    assert.equal(evaluateConfidence(normalize('stt-no-speech'), THRESHOLDS).outcome, 'NO_SPEECH');
    assert.equal(evaluateConfidence(normalize('stt-repetition'), THRESHOLDS).outcome, 'REPETITION');
  });

  test('avg_logprob exactly at −1.0 is not "below −1.0"', () => {
    const verdict = evaluateConfidence(
      t('hi', { kind: 'derived', value: Math.exp(-1), source: 'avg_logprob', avgLogprob: -1.0, noSpeechProb: null, compressionRatio: null }),
      THRESHOLDS,
    );
    assert.equal(verdict.outcome, 'VALIDATED');
  });

  test('an empty transcript is never validated, whatever the score', () => {
    assert.equal(evaluateConfidence(t('   ', { kind: 'score', value: 0.99, source: 'provider_confidence' }), THRESHOLDS).outcome, 'EMPTY_TRANSCRIPT');
  });

  test('unavailable confidence is its own outcome, carrying the configured policy and no number', () => {
    assert.deepEqual(evaluateConfidence(t('hi', { kind: 'unavailable' }), THRESHOLDS), {
      outcome: 'CONFIDENCE_UNAVAILABLE',
      policy: 'confirm',
      confidence: null,
    });
    assert.equal(
      (evaluateConfidence(t('hi', { kind: 'unavailable' }), { ...THRESHOLDS, unavailablePolicy: 'reprompt' }) as { policy: string }).policy,
      'reprompt',
    );
  });
});
