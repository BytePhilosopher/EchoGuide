import { Router, Request, Response } from 'express';
import { ConfidenceGateSchema, ActionPlanSchema } from '@echoguide/openapi';
import { AddisAIAdapter } from '../../shared/adapters/addis_ai_adapter';

export const commandsModule = Router();
const addisAdapter = new AddisAIAdapter();

/**
 * Section 6 & 8.3 Commands Module
 * Pipeline: Audio Transcribe -> Confidence Gate -> LLM Planning -> Allowlist Validation
 * RULE: Audio payload and transcript are held in memory ONLY for request lifecycle. NEVER persisted.
 */
commandsModule.post('/v1/commands', async (req: Request, res: Response) => {
  const idempotencyKey = req.header('X-Idempotency-Key');
  const installId = req.header('X-Install-ID');

  if (!idempotencyKey || !installId) {
    return res.status(400).json({ error: "Missing required headers X-Idempotency-Key or X-Install-ID" });
  }

  const { audio_base64, duration_ms, screen_context } = req.body;

  // 1. Minimum utterance check (§6.1: < 0.4s discarded on phone / API)
  if (!duration_ms || duration_ms < 400) {
    return res.status(400).json({ error: "Utterance below minimum 0.4s threshold" });
  }

  try {
    const audioBuffer = Buffer.from(audio_base64, 'base64');

    // 2. Transcribe via Addis AI Provider (§6.1)
    const sttResult = await addisAdapter.transcribeAudio(audioBuffer, 'am-ET');

    // 3. Section 6.2 Confidence Gate Validation
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

    // 4. Section 10.2 Plan Generation & Allowlist Validation
    const rawPlan = await addisAdapter.planActionSequence(sttResult.text, screen_context);

    // Validate schema & allowlist safety
    const planValidation = ActionPlanSchema.safeParse(rawPlan);
    if (!planValidation.success) {
      return res.status(200).json({
        status: "REJECTED",
        reprompt_reason: "Plan failed allowlist validation",
      });
    }

    return res.status(200).json({
      command_id: req.header('X-Request-ID') || 'cmd-' + Date.now(),
      status: rawPlan.steps.some((s: any) => s.is_destructive) ? "CONFIRMATION_REQUIRED" : "ACCEPTED",
      action_plan: rawPlan,
    });

  } catch (error: any) {
    return res.status(500).json({ error: "Command pipeline processing failed", details: error.message });
  }
});
