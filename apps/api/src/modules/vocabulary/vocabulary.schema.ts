import { z } from 'zod';
import { VOCABULARY_KINDS } from '../../shared/database/enums';

export const MAX_TERMS_PER_USER = 500;

// Control characters are refused so a term cannot smuggle line breaks into a provider request.
const Term = z
  .string()
  .transform((value) => value.normalize('NFC').trim())
  .pipe(z.string().min(1).max(64).regex(/^[^\p{Cc}]+$/u, 'Term contains control characters'));

export const CreateTermSchema = z.object({ term: Term, kind: z.enum(VOCABULARY_KINDS) }).strict();

export const UpdateTermSchema = z
  .object({ term: Term.optional(), kind: z.enum(VOCABULARY_KINDS).optional() })
  .strict()
  .refine((value) => value.term !== undefined || value.kind !== undefined, 'Nothing to update');
