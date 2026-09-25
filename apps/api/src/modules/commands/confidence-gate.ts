import { z } from 'zod';

export const CONFIDENCE_FLOOR = Number(process.env.ADDIS_CONFIDENCE_FLOOR ?? 0.6);

export const ConfidenceGateSchema = z.object({
  confidence: z
    .number()
    .min(CONFIDENCE_FLOOR, 'Transcript confidence below the floor'),
  text: z.string().trim().min(1, 'Transcript was empty'),
});
