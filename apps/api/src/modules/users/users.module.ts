import { Router, Request, Response } from 'express';

export const usersModule = Router();

usersModule.get('/v1/users/me', (req: Request, res: Response) => {
  return res.json({
    user_id: 'usr-12345',
    locale: 'am-ET',
    preferences: {
      speech_rate: 100,
      wake_word: 'Echo',
    },
  });
});
