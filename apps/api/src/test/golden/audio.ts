import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GoldenEntry } from './manifest.schema';

const SAMPLE_RATE = 16_000;

/** Clearly synthetic PCM16 mono audio: silence, a 440 Hz tone, or deterministic noise. Never speech. */
export function syntheticPcm(signal: 'tone' | 'silence' | 'noise', durationMs: number): Buffer {
  const samples = Math.round((SAMPLE_RATE * durationMs) / 1000);
  const out = Buffer.alloc(samples * 2);
  let seed = 0x2545f491;
  for (let i = 0; i < samples; i += 1) {
    let value = 0;
    if (signal === 'tone') value = Math.round(Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 8000);
    if (signal === 'noise') {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      value = (seed % 4000) | 0;
    }
    out.writeInt16LE(value, i * 2);
  }
  return out;
}

/** Reads the PCM payload of a 16 kHz mono PCM16 WAV, refusing anything else. */
export function pcmFromWav(wav: Buffer): Buffer {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let offset = 12;
  let format: { channels: number; rate: number; bits: number } | null = null;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = { channels: wav.readUInt16LE(body + 2), rate: wav.readUInt32LE(body + 4), bits: wav.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (!format || format.channels !== 1 || format.rate !== SAMPLE_RATE || format.bits !== 16) {
        throw new Error('golden recordings must be 16 kHz, mono, 16-bit PCM');
      }
      return wav.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}

export async function loadEntryAudio(entry: GoldenEntry, root: string): Promise<Buffer | null> {
  if (entry.audio.kind === 'synthetic') return syntheticPcm(entry.audio.signal, entry.audio.duration_ms);
  try {
    return pcmFromWav(await readFile(join(root, entry.audio.path)));
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
}
