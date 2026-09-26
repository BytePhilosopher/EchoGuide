import express, { Router, type RequestHandler } from 'express';
import { zCommandRequest } from '@echoguide/openapi';
import { badRequest, HttpError } from '../../shared/errors';
import { asyncHandler, isUuid } from '../../shared/http';
import { fingerprintOf, type IdempotencyStore } from '../../shared/idempotency/idempotency';
import { principalOf } from '../auth/auth.middleware';
import type { CommandPipeline } from './commands.service';

// 16 kHz mono PCM16 is 32 bytes per millisecond (docs: architecture/command-pipeline).
const BYTES_PER_MS = 32;
export const MIN_AUDIO_BYTES = 400 * BYTES_PER_MS;
// 15 s maximum utterance, plus one second of slack for the capture pre-roll.
export const MAX_AUDIO_BYTES = 16_000 * BYTES_PER_MS;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

function decodeAudio(value: string): Buffer {
  if (value.length % 4 !== 0 || !BASE64_RE.test(value)) throw badRequest('audio_base64 is not valid base64');
  const audio = Buffer.from(value, 'base64');
  if (audio.length < MIN_AUDIO_BYTES) throw badRequest('Audio is shorter than 0.4 s');
  if (audio.length > MAX_AUDIO_BYTES) throw badRequest('Audio is longer than 15 s');
  return audio;
}

export function commandsModule(deps: {
  pipeline: CommandPipeline;
  idempotency: IdempotencyStore;
  authenticate: RequestHandler;
  rateLimit: RequestHandler;
  bodyLimitBytes: number;
}): Router {
  const router = Router();

  router.post(
    '/v1/commands',
    // The only route that carries audio gets the audio-sized limit; everything else stays small.
    express.json({ limit: deps.bodyLimitBytes }),
    deps.authenticate,
    deps.rateLimit,
    asyncHandler(async (req, res) => {
      const idempotencyKey = req.header('X-Idempotency-Key');
      if (!isUuid(idempotencyKey)) throw badRequest('X-Idempotency-Key must be a UUID');
      const body = zCommandRequest.safeParse(req.body);
      if (!body.success) throw badRequest('Invalid command request');
      const { audio_base64, screen_context, language } = body.data;
      const audio = decodeAudio(audio_base64);
      const principal = principalOf(req);

      // Scoped per user: one user's key can never replay another user's response.
      const begin = await deps.idempotency.begin(`cmd:${principal.userId}`, idempotencyKey, fingerprintOf(req.body));
      if (begin.kind === 'replay') {
        res.setHeader('Idempotent-Replayed', 'true');
        res.status(begin.response.status).json(begin.response.body);
        return;
      }
      if (begin.kind === 'mismatch') throw new HttpError(422, 'Idempotency key was already used with a different request');
      if (begin.kind === 'in_progress') throw new HttpError(409, 'A request with this idempotency key is in progress', { 'Retry-After': '1' });

      let result;
      try {
        result = await deps.pipeline.run(principal.userId, req.requestId, { audio, language, screenContext: screen_context });
      } catch (error) {
        await begin.lease?.release();
        throw error;
      }
      await begin.lease?.complete({ status: result.status, body: result.body });
      for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
      res.status(result.status).json(result.body);
    }),
  );

  return router;
}
