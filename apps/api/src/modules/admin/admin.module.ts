import { Router, Request, Response } from 'express';

export const adminModule = Router();

adminModule.get('/v1/admin/users/:userId', (req: Request, res: Response) => {
  return res.json({
    userId: req.params.userId,
    status: 'active',
    registered_at: '2026-09-01T10:00:00Z',
  });
});

adminModule.post('/v1/admin/users/:userId/suspend', (req: Request, res: Response) => {
  return res.json({ status: 'suspended', userId: req.params.userId });
});
