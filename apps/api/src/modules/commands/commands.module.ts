import { Router, Request, Response } from 'express';
import { zActionPlan, zCommandRequest } from '@echoguide/openapi';
import { ConfidenceGateSchema } from './confidence-gate';
import { AddisAIAdapter } from '../../shared/adapters/addis_ai_adapter';
import { checkCanRunCommand } from '../billing/billing.service';
import { emit } from '../telemetry/telemetry.service';
import { logStructured } from '../../shared/logger';

export const commandsModule = Router();
const addisAdapter = new AddisAIAdapter();

function emitSafe(
  req: Request,
  started: number,
  outcome: 'done' | 'failed' | 'rejected' | 'blocked' | 'cancelled',
  stageTimings: Record<string, number>,
  confidence?: number,
): void {
  emit({
    request_id: req.requestId,
    user_id: req.userId,
    outcome,
    duration_ms: Math.max(0, Date.now() - started),
    confidence,
    stage_timings: stageTimings,
  });
}

commandsModule.post('/v1/commands', async (req: Request, res: Response) => {
  const started = Date.now();
  const stageTimings: Record<string, number> = {};
  const idempotencyKey = req.header('X-Idempotency-Key');
  const installId = req.header('X-Install-ID');

  if (!idempotencyKey || !installId) {
    return res.status(400).json({ error: 'Missing required headers X-Idempotency-Key or X-Install-ID' });
  }

  const body = zCommandRequest.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid command request' });
  }
  const { audio_base64, screen_context, language } = body.data;

  const billingMark = Date.now();
  const billing = await checkCanRunCommand(req.userId, idempotencyKey);
  stageTimings.billing_ms = Date.now() - billingMark;
  if (billing.allowed === false) {
    emitSafe(req, started, 'blocked', stageTimings);
    return res.status(200).json({
      command_id: req.requestId,
      status: 'REJECTED',
      reprompt_reason: billing.reason,
      speak_code: billing.speak_code,
    });
  }

  try {
    const audioBuffer = Buffer.from(audio_base64, 'base64');
    const sttMark = Date.now();
    const sttResult = await addisAdapter.transcribeAudio(audioBuffer, language);
    stageTimings.stt_ms = Date.now() - sttMark;

    const gateMark = Date.now();
    const gateValidation = ConfidenceGateSchema.safeParse({
      confidence: sttResult.confidence,
      text: sttResult.text,
    });
    stageTimings.gate_ms = Date.now() - gateMark;

    if (!gateValidation.success) {
      emitSafe(req, started, 'rejected', stageTimings, sttResult.confidence);
      return res.status(200).json({
        command_id: req.requestId,
        status: 'REPROMPT',
        reprompt_reason: 'Low confidence speech transcription',
        speak_code: 'RETRY',
      });
    }

    const planMark = Date.now();
    const rawPlan = await addisAdapter.planActionSequence(sttResult.text, screen_context);
    stageTimings.plan_ms = Date.now() - planMark;
    const planValidation = zActionPlan.safeParse(rawPlan);
    if (!planValidation.success) {
      emitSafe(req, started, 'blocked', stageTimings, sttResult.confidence);
      return res.status(200).json({
        command_id: req.requestId,
        status: 'REJECTED',
        reprompt_reason: 'Plan failed allowlist validation',
        speak_code: 'ERR_REJECTED',
      });
    }
    const plan = planValidation.data;
    const status = plan.steps.some((step) => step.is_destructive) ? 'CONFIRMATION_REQUIRED' : 'ACCEPTED';

    emitSafe(req, started, 'done', stageTimings, sttResult.confidence);
    return res.status(200).json({
      command_id: req.requestId,
      status,
      action_plan: plan,
      speak_code: status === 'CONFIRMATION_REQUIRED' ? 'CONFIRM' : 'ACK',
    });
  } catch (error: unknown) {
    logStructured('command.failed', {
      request_id: req.requestId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    emitSafe(req, started, 'failed', stageTimings);
    return res.status(500).json({ error: 'Command pipeline processing failed' });
  }
});
