import { randomBytes, randomUUID } from 'node:crypto';
import { currentScope } from '../context';
import { describeError, logStructured } from '../logger';
import { CircuitBreaker, CircuitOpenError } from '../resilience/circuit-breaker';
import {
  AddisAIResponseAdapter,
  type NormalizedTranscription,
  type ParseResult,
} from './addis_ai_response_adapter';

export interface ScreenContext {
  current_package: string;
  view_tree_summary: string;
}

export type AddisStage = 'transcribe' | 'plan';

/** The provider failed, timed out or is unreachable. Counts toward the circuit breaker. */
export class AddisAIError extends Error {
  constructor(
    readonly stage: AddisStage,
    readonly status: number,
    readonly timedOut = false,
  ) {
    super(`addis_ai_${stage}_failed`);
    this.name = 'AddisAIError';
  }

  get countsAsOutage(): boolean {
    return this.timedOut || this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** The provider answered, but not in a shape this adapter understands. Not an outage. */
export class AddisAISchemaError extends Error {
  constructor(
    readonly stage: AddisStage,
    readonly mismatches: string[],
  ) {
    super(`addis_ai_${stage}_schema_mismatch`);
    this.name = 'AddisAISchemaError';
  }
}

export type AddisClientOptions = {
  apiKey: string;
  baseUrl: string;
  transcribeTimeoutMs: number;
  planTimeoutMs: number;
  breaker: CircuitBreaker;
  sttVocabularyField?: string;
};

const SAMPLE_RATE = 16_000;

const PLAN_INSTRUCTION = [
  'You turn a spoken command into a plan of interface actions for an Android phone.',
  'Reply with JSON only. No prose, no code fence.',
  'Shape: {"package_name":string,"requires_user_confirmation":boolean,"steps":[{"action_type":"TAP"|"SCROLL"|"TEXT_INPUT"|"BACK"|"HOME","target_node_id":string|null,"payload":string|null,"is_destructive":boolean}]}',
  'Only use target_node_id values that appear in the screen listing.',
  'Set is_destructive true for anything that sends, pays, deletes or cannot be undone.',
  'If the command cannot be carried out on this screen, reply {"steps":[]}.',
].join('\n');

export interface TranscriptionPort {
  transcribeAudio(audio: Buffer, language: string, vocabulary?: string[]): Promise<NormalizedTranscription>;
}

export interface PlanningPort {
  planActionSequence(transcript: string, screenContext: ScreenContext): Promise<unknown>;
}

export class AddisAIAdapter implements TranscriptionPort, PlanningPort {
  constructor(private readonly options: AddisClientOptions) {}

  get breaker(): CircuitBreaker {
    return this.options.breaker;
  }

  async transcribeAudio(audioBuffer: Buffer, language: string, vocabulary: string[] = []): Promise<NormalizedTranscription> {
    const form = new FormData();
    form.append('audio', new Blob([toWav(audioBuffer)], { type: 'audio/wav' }), 'command.wav');
    const requestData: Record<string, unknown> = { language_code: language.startsWith('en') ? 'en' : 'am' };
    // The vendor's vocabulary-bias parameter is not documented in this repository. Terms are
    // sent only when an operator configures the field name after confirming it with the vendor.
    if (this.options.sttVocabularyField && vocabulary.length > 0) {
      requestData[this.options.sttVocabularyField] = vocabulary;
    }
    form.append('request_data', JSON.stringify(requestData));

    const payload = await this.send('/api/v2/stt', { method: 'POST', body: form }, this.options.transcribeTimeoutMs, 'transcribe');
    const result: ParseResult<NormalizedTranscription> = AddisAIResponseAdapter.parseTranscription(payload);
    if (!result.ok) {
      logStructured('addis.schema_mismatch', { stage: 'transcribe', fields: result.mismatches });
      throw new AddisAISchemaError('transcribe', result.mismatches);
    }
    if (result.value.metadata.mismatches.length > 0) {
      logStructured('addis.schema_mismatch', { stage: 'transcribe', fields: result.value.metadata.mismatches, fatal: false });
    }
    if (result.value.confidence.kind === 'unavailable') {
      logStructured('addis.confidence_unavailable', { shape: result.value.metadata.shape });
    }
    return result.value;
  }

  /**
   * Returns the planner's plan, with server-assigned ids, or null when the planner's reply cannot
   * be read. The caller validates the result against the ActionPlan contract before using it.
   */
  async planActionSequence(transcript: string, screenContext: ScreenContext): Promise<unknown> {
    const prompt = [
      `Foreground app: ${screenContext.current_package}`,
      'Screen:',
      screenContext.view_tree_summary,
      '',
      `Command: ${transcript}`,
    ].join('\n');

    const payload = await this.send(
      '/api/v1/chat_generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          system: PLAN_INSTRUCTION,
          generation_config: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      },
      this.options.planTimeoutMs,
      'plan',
    );

    const result = AddisAIResponseAdapter.parsePlan(payload);
    if (!result.ok) {
      logStructured('addis.schema_mismatch', { stage: 'plan', fields: result.mismatches });
      return null;
    }
    const parsed = result.value.raw;
    return {
      ...parsed,
      plan_id: randomUUID(),
      package_name: parsed.package_name ?? screenContext.current_package,
      steps: Array.isArray(parsed.steps) ? parsed.steps.map(normalizeStep) : parsed.steps,
    };
  }

  private async send(path: string, init: RequestInit, timeoutMs: number, stage: AddisStage): Promise<unknown> {
    return this.options.breaker.execute(
      async () => {
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
        const started = Date.now();
        const scope = currentScope();
        const headers: Record<string, string> = { ...((init.headers as Record<string, string>) ?? {}), 'x-api-key': this.options.apiKey };
        if (scope) {
          // Correlation only: a random id and a W3C traceparent, never user data.
          headers['x-request-id'] = scope.requestId;
          headers.traceparent = `00-${scope.traceId}-${randomBytes(8).toString('hex')}-01`;
        }
        try {
          const response = await fetch(`${this.options.baseUrl}${path}`, { ...init, signal: controller.signal, headers });
          logStructured('addis.call', { stage, status: response.status, duration_ms: Date.now() - started });
          if (!response.ok) throw new AddisAIError(stage, response.status);
          try {
            return (await response.json()) as unknown;
          } catch {
            throw new AddisAISchemaError(stage, ['$:json']);
          }
        } catch (error) {
          if (error instanceof AddisAIError || error instanceof AddisAISchemaError) throw error;
          logStructured('addis.call', { stage, status: 0, timed_out: timedOut, duration_ms: Date.now() - started, ...describeError(error) });
          throw new AddisAIError(stage, 0, timedOut);
        } finally {
          clearTimeout(timer);
        }
      },
      (error) => error instanceof AddisAIError && error.countsAsOutage,
    );
  }
}

/**
 * The planner is instructed to write `null` for an absent target or payload, while the ActionStep
 * contract models them as optional strings. Absent is absent: nulls are dropped here, so a plan
 * that follows the instruction is not rejected for it. Every other field is left for the contract
 * to judge.
 */
function normalizeStep(step: unknown): unknown {
  if (typeof step !== 'object' || step === null || Array.isArray(step)) return step;
  const normalized: Record<string, unknown> = { ...step, step_id: randomUUID() };
  for (const key of ['target_node_id', 'payload']) {
    if (normalized[key] === null) delete normalized[key];
  }
  return normalized;
}

export function createAddisBreaker(failureThreshold: number, resetMs: number): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold,
    resetMs,
    onStateChange: (from, to) => logStructured('addis.breaker', { from, to }),
  });
}

export { CircuitOpenError };

function toWav(pcm: Buffer): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(44 + pcm.length));
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);

  return out;
}
