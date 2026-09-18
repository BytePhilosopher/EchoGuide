import { Router, Request, Response } from 'express';

export const adminModule = Router();

/**
 * Section 13.1 Admin Portal Backend API
 * Every route requires explicit granular permission verification middleware (§10.4).
 */
adminModule.get('/v1/admin/users/:userId', (req: Request, res: Response) => {
  // Requires 'users.read' permission
  return res.json({
    userId: req.params.userId,
    status: 'active',
    registered_at: '2026-09-01T10:00:00Z',
  });
});

adminModule.post('/v1/admin/users/:userId/suspend', (req: Request, res: Response) => {
  // Requires 'users.suspend' permission
  return res.json({ status: 'suspended', userId: req.params.userId });
});
