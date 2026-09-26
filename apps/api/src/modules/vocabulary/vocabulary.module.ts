import { Router, type RequestHandler } from 'express';
import { badRequest } from '../../shared/errors';
import { asyncHandler } from '../../shared/http';
import { principalOf } from '../auth/auth.middleware';
import { CreateTermSchema, UpdateTermSchema } from './vocabulary.schema';
import type { VocabularyService } from './vocabulary.service';

export function vocabularyModule(vocabulary: VocabularyService, authenticate: RequestHandler): Router {
  const router = Router();

  router.get(
    '/v1/vocabulary',
    authenticate,
    asyncHandler(async (req, res) => {
      res.json({ terms: await vocabulary.list(principalOf(req).userId) });
    }),
  );

  router.post(
    '/v1/vocabulary',
    authenticate,
    asyncHandler(async (req, res) => {
      const body = CreateTermSchema.safeParse(req.body);
      if (!body.success) throw badRequest();
      res.status(201).json(await vocabulary.create(principalOf(req).userId, body.data));
    }),
  );

  router.patch(
    '/v1/vocabulary/:termId',
    authenticate,
    asyncHandler(async (req, res) => {
      const body = UpdateTermSchema.safeParse(req.body);
      if (!body.success) throw badRequest();
      res.json(await vocabulary.update(principalOf(req).userId, req.params.termId, body.data));
    }),
  );

  router.delete(
    '/v1/vocabulary/:termId',
    authenticate,
    asyncHandler(async (req, res) => {
      await vocabulary.remove(principalOf(req).userId, req.params.termId);
      res.status(204).end();
    }),
  );

  return router;
}
