import { Router, Request, Response } from 'express';
import { zActionPlan, zCommandRequest } from '@echoguide/openapi';
import { ConfidenceGateSchema } from './confidence-gate';
import { AddisAIAdapter } from '../../shared/adapters/addis_ai_adapter';

export const commandsModule = Router();
const addisAdapter = new AddisAIAdapter();

// Audio and transcripts live in memory for this request only. Never persist or log them.
commandsModule.post('/v1/commands', async (req: Request, res: Response) => {
  const idempotencyKey = req.header('X-Idempotency-Key');
  const installId = req.header('X-Install-ID');

  if (!idempotencyKey || !installId) {
    return res.status(400).json({ error: "Missing required headers X-Idempotency-Key or X-Install-ID" });
  }

  const body = zCommandRequest.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid command request" });
  }
  const { audio_base64, screen_context } = body.data;

  try {
    const audioBuffer = Buffer.from(audio_base64, 'base64');
    const sttResult = await addisAdapter.transcribeAudio(audioBuffer, 'am-ET');

    const gateValidation = ConfidenceGateSchema.safeParse({
      avg_logprob: sttResult.avg_logprob,
      no_speech_prob: sttResult.no_speech_prob,
      compression_ratio: sttResult.compression_ratio,
    });

    if (!gateValidation.success) {
      return res.status(200).json({
        status: "REPROMPT",
        reprompt_reason: "Low confidence speech transcription",
      });
    }

    const rawPlan = await addisAdapter.planActionSequence(sttResult.text, screen_context);
    const planValidation = zActionPlan.safeParse(rawPlan);
    if (!planValidation.success) {
      return res.status(200).json({
        status: "REJECTED",
        reprompt_reason: "Plan failed allowlist validation",
      });
    }
    const plan = planValidation.data;

    return res.status(200).json({
      command_id: req.header('X-Request-ID') || 'cmd-' + Date.now(),
      status: plan.steps.some((step) => step.is_destructive) ? "CONFIRMATION_REQUIRED" : "ACCEPTED",
      action_plan: plan,
    });

  } catch (error: unknown) {
    console.error(JSON.stringify({
      event: "command.failed",
      requestId: idempotencyKey,
      error: error instanceof Error ? error.message : "unknown",
    }));
    return res.status(500).json({ error: "Command pipeline processing failed" });
  }
});
