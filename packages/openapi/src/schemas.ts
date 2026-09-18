import { z } from 'zod';

/**
 * Section 6.2: Confidence Gate thresholds
 */
export const ConfidenceGateSchema = z.object({
  avg_logprob: z.number().max(-1.0, "Derived transcript is low confidence (guessing)"),
  no_speech_prob: z.number().max(0.6, "Payload is likely background noise"),
  compression_ratio: z.number().max(2.4, "Detected repetition loop failure mode"),
});

export const ActionStepSchema = z.object({
  step_id: z.string().uuid(),
  action_type: z.enum(['TAP', 'SCROLL', 'TEXT_INPUT', 'BACK', 'HOME']),
  target_node_id: z.string().optional(),
  payload: z.string().optional(),
  is_destructive: z.boolean().default(false),
});

export const ActionPlanSchema = z.object({
  plan_id: z.string().uuid(),
  package_name: z.string(),
  steps: z.array(ActionStepSchema),
  requires_user_confirmation: z.boolean().default(false),
});

export const CommandRequestSchema = z.object({
  audio_base64: z.string(),
  duration_ms: z.number().min(400).max(15000),
  language: z.enum(['am-ET', 'en-US']).default('am-ET'),
  screen_context: z.object({
    current_package: z.string(),
    view_tree_summary: z.string(),
  }),
});

export const CommandResponseSchema = z.object({
  command_id: z.string().uuid(),
  status: z.enum(['ACCEPTED', 'REJECTED', 'REPROMPT', 'CONFIRMATION_REQUIRED']),
  reprompt_reason: z.string().optional(),
  action_plan: ActionPlanSchema.optional(),
  speech_response_text: z.string().optional(),
});

export type ActionStep = z.infer<typeof ActionStepSchema>;
export type ActionPlan = z.infer<typeof ActionPlanSchema>;
export type CommandRequest = z.infer<typeof CommandRequestSchema>;
export type CommandResponse = z.infer<typeof CommandResponseSchema>;
