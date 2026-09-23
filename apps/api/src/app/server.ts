import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { authModule } from '../modules/auth/auth.module';
import { usersModule } from '../modules/users/users.module';
import { commandsModule } from '../modules/commands/commands.module';
import { consentModule } from '../modules/consent/consent.module';
import { telemetryModule } from '../modules/telemetry/telemetry.module';
import { adminModule } from '../modules/admin/admin.module';

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' })); // base64 PCM audio buffers exceed the 100kb default

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'echoguide-api-monolith' });
});

app.use(authModule);
app.use(usersModule);
app.use(commandsModule);
app.use(consentModule);
app.use(telemetryModule);
app.use(adminModule);

app.listen(port, () => {
  console.log(JSON.stringify({ event: 'api.started', port }));
});
