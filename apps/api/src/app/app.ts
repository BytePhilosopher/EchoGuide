import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { requestContext } from './request-context';
import { authModule } from '../modules/auth/auth.module';
import { usersModule } from '../modules/users/users.module';
import { commandsModule } from '../modules/commands/commands.module';
import { appGrantsModule } from '../modules/commands/app-grants.module';
import { consentModule } from '../modules/consent/consent.module';
import { telemetryModule } from '../modules/telemetry/telemetry.module';
import { billingModule } from '../modules/billing/billing.module';
import { phrasesModule } from '../modules/phrases/phrases.module';
import { adminModule } from '../modules/admin/admin.module';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'echoguide-api-monolith' });
  });

  app.use(requestContext);
  app.use(authModule);
  app.use(usersModule);
  app.use(commandsModule);
  app.use(appGrantsModule);
  app.use(consentModule);
  app.use(telemetryModule);
  app.use(billingModule);
  app.use(phrasesModule);
  app.use(adminModule);
  return app;
}
