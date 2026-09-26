import { zActionPlan } from '@echoguide/openapi';
import {
  AddisAIError,
  AddisAISchemaError,
  CircuitOpenError,
  type PlanningPort,
  type ScreenContext,
  type TranscriptionPort,
} from '../../shared/adapters/addis_ai_adapter';
import type { NormalizedTranscription } from '../../shared/adapters/addis_ai_response_adapter';
import { describeError, logStructured } from '../../shared/logger';
import type { BillingService } from '../billing/billing.service';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { VocabularyService } from '../vocabulary/vocabulary.service';
import type { AppGrantsService } from './app-grants.service';
import { evaluateConfidence, type GateThresholds, type GateVerdict } from './confidence-gate';

export type CommandInput = {
  audio: Buffer;
  language: 'am-ET' | 'en-US';
  screenContext: ScreenContext;
};

export type CommandResult = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };

type Outcome = 'done' | 'failed' | 'rejected' | 'blocked' | 'cancelled';

const REPROMPT_REASONS: Record<Exclude<GateVerdict['outcome'], 'VALIDATED' | 'CONFIDENCE_UNAVAILABLE'>, string> = {
  LOW_CONFIDENCE: 'Low confidence speech transcription',
  EMPTY_TRANSCRIPT: 'No words were recognised',
  NO_SPEECH: 'No speech detected',
  REPETITION: 'Transcription failed a repetition check',
};

class ProviderFailure extends Error {
  constructor(readonly result: CommandResult) {
    super('provider_failure');
  }
}

/**
 * The hot path: billing gate → transcribe → confidence gate → plan → contract validation →
 * per-app allowlist → confirmation policy. Every exit is a defined response; provider trouble is
 * a 502/503/504 with a safe message, never provider detail. The transcript lives only in this
 * function's scope and is never logged or stored.
 */
export class CommandPipeline {
  constructor(
    private readonly deps: {
      transcriber: TranscriptionPort;
      planner: PlanningPort;
      billing: BillingService;
      grants: AppGrantsService;
      vocabulary: VocabularyService;
      telemetry: TelemetryService;
      thresholds: GateThresholds;
      sendVocabulary: boolean;
    },
  ) {}

  async run(userId: string, requestId: string, input: CommandInput): Promise<CommandResult> {
    const started = Date.now();
    const timings: Record<string, number> = {};
    const time = async <T>(stage: string, fn: () => Promise<T>): Promise<T> => {
      const mark = Date.now();
      try {
        return await fn();
      } finally {
        timings[stage] = Date.now() - mark;
      }
    };
    const finish = (outcome: Outcome, result: CommandResult, confidence?: number | null): CommandResult => {
      this.deps.telemetry.emit({
        request_id: requestId,
        user_id: userId,
        outcome,
        duration_ms: Math.max(0, Date.now() - started),
        confidence: confidence ?? undefined,
        stage_timings: timings,
      });
      return result;
    };
    const reply = (body: Record<string, unknown>): CommandResult => ({ status: 200, body: { command_id: requestId, ...body } });

    const billing = await time('billing_ms', () => this.deps.billing.checkCanRunCommand(userId));
    if (!billing.allowed) {
      if (billing.reason === 'unverified') {
        return finish('blocked', { status: 503, body: { error: 'Billing status could not be verified' }, headers: { 'Retry-After': '5' } });
      }
      return finish(
        'blocked',
        reply({
          status: 'REJECTED',
          reprompt_reason: billing.reason === 'quota' ? 'Command quota exhausted' : 'Subscription inactive',
          speak_code: billing.speak_code,
        }),
      );
    }

    try {
      const vocabulary = this.deps.sendVocabulary ? await time('vocabulary_ms', () => this.deps.vocabulary.biasTerms(userId)) : [];
      const transcription: NormalizedTranscription = await time('stt_ms', () =>
        this.provider(() => this.deps.transcriber.transcribeAudio(input.audio, input.language, vocabulary)),
      );

      const verdict = evaluateConfidence(transcription, this.deps.thresholds);
      logStructured('command.gate', { outcome: verdict.outcome, shape: transcription.metadata.shape });
      if (verdict.outcome !== 'VALIDATED' && !(verdict.outcome === 'CONFIDENCE_UNAVAILABLE' && verdict.policy === 'confirm')) {
        const reason =
          verdict.outcome === 'CONFIDENCE_UNAVAILABLE' ? 'Transcription confidence unavailable' : REPROMPT_REASONS[verdict.outcome];
        return finish('rejected', reply({ status: 'REPROMPT', reprompt_reason: reason, speak_code: 'RETRY' }), verdict.confidence);
      }

      const rawPlan = await time('plan_ms', () =>
        this.provider(() => this.deps.planner.planActionSequence(transcription.transcript, input.screenContext)),
      );
      const parsed = zActionPlan.safeParse(rawPlan);
      if (!parsed.success) {
        return finish(
          'blocked',
          reply({ status: 'REJECTED', reprompt_reason: 'Plan failed schema validation', speak_code: 'ERR_REJECTED' }),
          verdict.confidence,
        );
      }
      const plan = parsed.data;
      if (plan.steps.length === 0) {
        return finish(
          'blocked',
          reply({ status: 'REJECTED', reprompt_reason: 'Command cannot be carried out on this screen', speak_code: 'ERR_REJECTED' }),
          verdict.confidence,
        );
      }

      const granted = await time('allowlist_ms', () => this.deps.grants.isGranted(userId, plan.package_name));
      if (!granted) {
        return finish(
          'blocked',
          reply({ status: 'REJECTED', reprompt_reason: 'App not authorized for voice control', speak_code: 'ERR_REJECTED' }),
          verdict.confidence,
        );
      }

      const mustConfirm =
        plan.requires_user_confirmation ||
        plan.steps.some((step) => step.is_destructive) ||
        verdict.outcome === 'CONFIDENCE_UNAVAILABLE';
      const status = mustConfirm ? 'CONFIRMATION_REQUIRED' : 'ACCEPTED';
      return finish(
        'done',
        reply({
          status,
          action_plan: { ...plan, requires_user_confirmation: mustConfirm },
          speak_code: mustConfirm ? 'CONFIRM' : 'ACK',
        }),
        verdict.confidence,
      );
    } catch (error) {
      if (error instanceof ProviderFailure) return finish('failed', error.result);
      logStructured('command.failed', describeError(error));
      return finish('failed', { status: 500, body: { error: 'Command pipeline processing failed' } });
    }
  }

  private async provider<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw new ProviderFailure({
          status: 503,
          body: { error: 'Voice service temporarily unavailable' },
          headers: { 'Retry-After': String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))) },
        });
      }
      if (error instanceof AddisAIError) {
        throw new ProviderFailure(
          error.timedOut
            ? { status: 504, body: { error: 'Voice service timed out' } }
            : { status: 503, body: { error: 'Voice service unavailable' }, headers: { 'Retry-After': '5' } },
        );
      }
      if (error instanceof AddisAISchemaError) {
        throw new ProviderFailure({ status: 502, body: { error: 'Voice service returned an unexpected response' } });
      }
      throw error;
    }
  }
}
