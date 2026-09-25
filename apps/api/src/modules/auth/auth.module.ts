import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { registerInstall } from './auth.service';

export const authModule = Router();

const RegisterDeviceSchema = z.object({
  install_id: z.string().min(1).max(128),
  phone_hash: z.string().min(16).max(128).optional(),
  model: z.string().min(1).max(128).optional(),
  locale: z.enum(['am-ET', 'en-US']).optional(),
});

authModule.post('/v1/auth/register-device', async (req: Request, res: Response) => {
  const parsed = RegisterDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid device registration' });
  }

  const userId = await registerInstall({
    installId: parsed.data.install_id,
    phoneHash: parsed.data.phone_hash,
    model: parsed.data.model,
    locale: parsed.data.locale,
  });

  if (!userId) {
    return res.status(503).json({ error: 'Registration unavailable' });
  }

  return res.json({ status: 'registered', install_id: parsed.data.install_id });
});
