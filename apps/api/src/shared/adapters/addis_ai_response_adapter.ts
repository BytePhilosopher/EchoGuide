/**
 * Normalises Addis AI responses into the shapes the command pipeline uses. Pure: no I/O.
 *
 * ASSUMPTIONS — the vendor's response schema is not published in this repository. What is known:
 *
 * 1. `POST /api/v2/stt` returns the transcript at `data.transcription`. This is the only shape the
 *    code and tests have ever relied on, so it is treated as required.
 * 2. docs/architecture/command-pipeline says the transcriber returns NO confidence score and the
 *    backend should derive one from Whisper-style signals (`avg_logprob`, `no_speech_prob`,
 *    `compression_ratio`). Whether those fields are returned, and where, is unverified. They are
 *    read from `segments[]` at the top level or under `data`, whichever is present.
 * 3. The existing test double returned a top-level `confidence` in 0..1. It is also accepted, at
 *    the top level or under `data`, because it cannot be ruled out.
 *
 * Anything else is reported as a schema mismatch (field paths only, never values) and a missing
 * score becomes `{ kind: 'unavailable' }`. It never becomes a number: the previous adapter turned
 * a missing score into 0, which silently rejected every command.
 *
 * Fixtures for each assumed shape live in src/test/fixtures/addis/. When the real schema is
 * confirmed, update this file and those fixtures together.
 */

export type ConfidenceSignal =
  | { kind: 'score'; value: number; source: 'provider_confidence' }
  | {
      kind: 'derived';
      value: number;
      source: 'avg_logprob';
      avgLogprob: number;
      noSpeechProb: number | null;
      compressionRatio: number | null;
    }
  | { kind: 'unavailable' };

export type NormalizedTranscription = {
  transcript: string;
  confidence: ConfidenceSignal;
  metadata: { shape: 'confidence_score' | 'segments' | 'transcript_only'; mismatches: string[] };
};

export type NormalizedPlan = {
  raw: Record<string, unknown>;
  metadata: { mismatches: string[] };
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: 'invalid_provider_response'; mismatches: string[] };

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function readSegments(container: Json, path: string, mismatches: string[]): ConfidenceSignal | null {
  const segments = container.segments;
  if (segments === undefined) return null;
  if (!Array.isArray(segments) || segments.length === 0) {
    mismatches.push(`${path}segments`);
    return null;
  }
  const logprobs: number[] = [];
  let noSpeech: number | null = null;
  let compression: number | null = null;
  for (const [index, segment] of segments.entries()) {
    if (!isObject(segment) || !isFiniteNumber(segment.avg_logprob)) {
      mismatches.push(`${path}segments[${index}].avg_logprob`);
      return null;
    }
    logprobs.push(segment.avg_logprob);
    if (isFiniteNumber(segment.no_speech_prob)) noSpeech = Math.max(noSpeech ?? 0, segment.no_speech_prob);
    if (isFiniteNumber(segment.compression_ratio)) compression = Math.max(compression ?? 0, segment.compression_ratio);
  }
  const avgLogprob = logprobs.reduce((sum, value) => sum + value, 0) / logprobs.length;
  return {
    kind: 'derived',
    // exp(mean log-probability) is the geometric-mean token probability: a 0..1 figure for telemetry.
    value: Math.min(1, Math.max(0, Math.exp(avgLogprob))),
    source: 'avg_logprob',
    avgLogprob,
    noSpeechProb: noSpeech,
    compressionRatio: compression,
  };
}

function readScore(container: Json, path: string, mismatches: string[]): ConfidenceSignal | null {
  if (container.confidence === undefined || container.confidence === null) return null;
  const value = container.confidence;
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    mismatches.push(`${path}confidence`);
    return null;
  }
  return { kind: 'score', value, source: 'provider_confidence' };
}

export const AddisAIResponseAdapter = {
  parseTranscription(payload: unknown): ParseResult<NormalizedTranscription> {
    const mismatches: string[] = [];
    if (!isObject(payload)) return { ok: false, reason: 'invalid_provider_response', mismatches: ['$'] };
    const data = payload.data;
    if (!isObject(data) || typeof data.transcription !== 'string') {
      return { ok: false, reason: 'invalid_provider_response', mismatches: ['data.transcription'] };
    }

    const confidence =
      readScore(payload, '', mismatches) ??
      readScore(data, 'data.', mismatches) ??
      readSegments(payload, '', mismatches) ??
      readSegments(data, 'data.', mismatches) ?? { kind: 'unavailable' as const };

    return {
      ok: true,
      value: {
        transcript: data.transcription,
        confidence,
        metadata: {
          shape:
            confidence.kind === 'score' ? 'confidence_score' : confidence.kind === 'derived' ? 'segments' : 'transcript_only',
          mismatches,
        },
      },
    };
  },

  /**
   * `POST /api/v1/chat_generate` returns the model's text at `response_text`. The planner is told
   * to reply with JSON only; the first JSON object in the text is taken. Structure is validated
   * against the ActionPlan contract by the caller, not here.
   */
  parsePlan(payload: unknown): ParseResult<NormalizedPlan> {
    if (!isObject(payload) || typeof payload.response_text !== 'string') {
      return { ok: false, reason: 'invalid_provider_response', mismatches: ['response_text'] };
    }
    const parsed = parseJsonObject(payload.response_text);
    if (!parsed) return { ok: false, reason: 'invalid_provider_response', mismatches: ['response_text:json'] };
    return { ok: true, value: { raw: parsed, metadata: { mismatches: [] } } };
  },
};

function parseJsonObject(text: string): Json | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}
