import { z } from 'zod';

const Gate = z.enum(['VALIDATED', 'LOW_CONFIDENCE', 'CONFIDENCE_UNAVAILABLE', 'NO_SPEECH', 'REPETITION', 'EMPTY_TRANSCRIPT', 'INVALID_PROVIDER_RESPONSE', 'NOT_SENT']);

const Audio = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('synthetic'), signal: z.enum(['tone', 'silence', 'noise']), duration_ms: z.number().int().min(1).max(20_000) }),
  z.object({ kind: z.literal('recording'), path: z.string().regex(/^recordings\/[A-Za-z0-9._-]+\.wav$/) }),
]);

export const GoldenEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    language: z.enum(['am-ET', 'en-US']),
    source: z.enum(['synthetic', 'approved-recording']),
    description: z.string().optional(),
    audio: Audio,
    expected_transcript: z.string().optional(),
    provider_fixture: z.string().optional(),
    expected: z.object({
      gate: Gate,
      http_status: z.number().int(),
      status: z.enum(['ACCEPTED', 'REJECTED', 'REPROMPT', 'CONFIRMATION_REQUIRED']).optional(),
    }),
    consent_ref: z.string().optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.source === 'synthetic' && entry.audio.kind !== 'synthetic') {
      ctx.addIssue({ code: 'custom', message: 'synthetic entries must use synthetic audio' });
    }
    if (entry.source === 'approved-recording') {
      if (entry.audio.kind !== 'recording') ctx.addIssue({ code: 'custom', message: 'recordings must reference a WAV file' });
      if (!entry.consent_ref) ctx.addIssue({ code: 'custom', message: 'recordings need a consent_ref' });
      if (!entry.expected_transcript) ctx.addIssue({ code: 'custom', message: 'recordings need an expected_transcript for WER' });
    }
    if (entry.expected.gate !== 'NOT_SENT' && !entry.provider_fixture) {
      ctx.addIssue({ code: 'custom', message: 'entries that reach the provider need a provider_fixture for replay' });
    }
  });

export const GoldenManifestSchema = z
  .object({ version: z.literal(1), entries: z.array(GoldenEntrySchema).min(1) })
  .strict()
  .superRefine((manifest, ctx) => {
    const ids = new Set<string>();
    for (const entry of manifest.entries) {
      if (ids.has(entry.id)) ctx.addIssue({ code: 'custom', message: `duplicate id ${entry.id}` });
      ids.add(entry.id);
    }
  });

export type GoldenEntry = z.infer<typeof GoldenEntrySchema>;
