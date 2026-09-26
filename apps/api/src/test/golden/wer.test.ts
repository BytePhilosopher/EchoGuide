import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pcmFromWav, syntheticPcm } from './audio';
import { GoldenManifestSchema } from './manifest.schema';
import { corpusWer, normalizeForWer, wordEdits } from './wer';

describe('word error rate', () => {
  test('identical text scores zero, ignoring case and punctuation', () => {
    assert.equal(corpusWer([{ reference: 'Open the chats.', hypothesis: 'open the chats' }]), 0);
  });

  test('counts substitutions, deletions and insertions', () => {
    assert.equal(wordEdits(['a', 'b', 'c'], ['a', 'x', 'c']), 1);
    assert.equal(wordEdits(['a', 'b', 'c'], ['a', 'c']), 1);
    assert.equal(wordEdits(['a', 'b'], ['a', 'b', 'c']), 1);
    assert.equal(wordEdits([], ['a']), 1);
  });

  test('corpus WER is total edits over total reference words', () => {
    const wer = corpusWer([
      { reference: 'one two three four', hypothesis: 'one two three four' },
      { reference: 'five six', hypothesis: 'five seven' },
    ]);
    assert.equal(wer, 1 / 6);
  });

  test('Ethiopic punctuation is treated as a separator', () => {
    assert.deepEqual(normalizeForWer('ቻቶችን፣ ክፈት።'), ['ቻቶችን', 'ክፈት']);
  });
});

describe('golden audio helpers', () => {
  test('synthetic audio has the capture format and exact length', () => {
    assert.equal(syntheticPcm('tone', 1000).length, 32_000);
    assert.ok(syntheticPcm('silence', 500).every((byte) => byte === 0));
  });

  test('WAV reader accepts 16 kHz mono PCM16 and refuses anything else', () => {
    const pcm = syntheticPcm('tone', 100);
    const wav = (rate: number, channels: number) => {
      const header = Buffer.alloc(44);
      header.write('RIFF', 0, 'ascii');
      header.writeUInt32LE(36 + pcm.length, 4);
      header.write('WAVEfmt ', 8, 'ascii');
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(channels, 22);
      header.writeUInt32LE(rate, 24);
      header.writeUInt32LE(rate * 2 * channels, 28);
      header.writeUInt16LE(2 * channels, 32);
      header.writeUInt16LE(16, 34);
      header.write('data', 36, 'ascii');
      header.writeUInt32LE(pcm.length, 40);
      return Buffer.concat([header, pcm]);
    };
    assert.deepEqual(pcmFromWav(wav(16_000, 1)), pcm);
    assert.throws(() => pcmFromWav(wav(44_100, 1)));
    assert.throws(() => pcmFromWav(wav(16_000, 2)));
    assert.throws(() => pcmFromWav(Buffer.from('not a wav at all, definitely not')));
  });

  test('the committed manifest validates', () => {
    GoldenManifestSchema.parse(JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf8')));
  });

  test('recordings require consent and a reference transcript', () => {
    const base = { id: 'am-0001', language: 'am-ET', source: 'approved-recording', audio: { kind: 'recording', path: 'recordings/am-0001.wav' }, provider_fixture: 'x', expected: { gate: 'VALIDATED', http_status: 200 } };
    assert.equal(GoldenManifestSchema.safeParse({ version: 1, entries: [base] }).success, false);
    assert.equal(GoldenManifestSchema.safeParse({ version: 1, entries: [{ ...base, consent_ref: 'C-1', expected_transcript: 'ሰላም' }] }).success, true);
  });
});
