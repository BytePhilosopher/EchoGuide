import { z } from 'zod';

export const ConfidenceGateSchema = z.object({
  avg_logprob: z.number().min(-1.0, "Derived transcript is low confidence (guessing)"),
  no_speech_prob: z.number().max(0.6, "Payload is likely background noise"),
  compression_ratio: z.number().max(2.4, "Detected repetition loop failure mode"),
});
