import { Router, Request, Response } from 'express';
import { getPhraseCatalog, type PhraseLocale } from './catalog';

export const phrasesModule = Router();

phrasesModule.get('/v1/phrases', (req: Request, res: Response) => {
  const language = (typeof req.query.language === 'string' ? req.query.language : 'am-ET') as PhraseLocale;
  if (language !== 'am-ET' && language !== 'en-US') {
    return res.status(400).json({ error: 'Invalid language' });
  }
  return res.json(getPhraseCatalog(language));
});
