import express from 'express';
import helmet from 'helmet';
import { requestContext } from './request-context';
import { errorHandler, notFoundHandler } from './error-handler';
import type { Container } from './container';
import { asyncHandler } from '../shared/http';
import { corsPolicy } from '../shared/security/cors';
import { clientIp } from '../shared/security/rate-limit';
import { authenticateRequest } from '../modules/auth/auth.middleware';
import { authModule } from '../modules/auth/auth.module';
import { usersModule } from '../modules/users/users.module';
import { commandsModule } from '../modules/commands/commands.module';
import { appGrantsModule } from '../modules/commands/app-grants.module';
import { consentModule } from '../modules/consent/consent.module';
import { telemetryModule } from '../modules/telemetry/telemetry.module';
import { billingModule } from '../modules/billing/billing.module';
import { phrasesModule } from '../modules/phrases/phrases.module';
import { adminModule } from '../modules/admin/admin.module';
import { vocabularyModule } from '../modules/vocabulary/vocabulary.module';

export function createApp(c: Container) {
  const app = express();
  const { rateLimit: limits } = c.config;
  app.disable('x-powered-by');
  app.set('trust proxy', c.config.trustProxy);

  app.use(requestContext);
  app.use(helmet());
  app.use(...corsPolicy(c.config.corsOrigins));

  // Liveness only: never touches a dependency, so a database blip does not restart the fleet.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'echoguide-api-monolith' });
  });

  // Readiness: can this instance serve traffic right now?
  app.get(
    '/ready',
    asyncHandler(async (_req, res) => {
      const [database, redis] = await Promise.all([
        c.pool.query('SELECT 1').then(() => 'ok' as const, () => 'unavailable' as const),
        c.redis.ping().then(() => 'ok' as const, () => 'unavailable' as const),
      ]);
      // Redis is not required to serve (the failure table degrades without it); Postgres is.
      res.status(database === 'ok' ? 200 : 503).json({ status: database === 'ok' ? 'ready' : 'unavailable', database, redis });
    }),
  );

  // A coarse per-IP ceiling for everything. Mobile carriers put many users behind one address,
  // so authenticated routes are limited per user below instead of tightly per IP.
  app.use(c.rateLimiter.middleware('ip', limits.ipMax, clientIp));

  const authenticate = authenticateRequest(c.auth);
  const perUser = c.rateLimiter.middleware('user', limits.userMax, (req) => req.principal?.userId ?? null);
  const authenticated = [authenticate, perUser];
  const authLimit = c.rateLimiter.middleware('auth', limits.authMax, clientIp);

  // Mounted before the global JSON parser: it has its own, audio-sized body limit.
  app.use(
    commandsModule({
      pipeline: c.pipeline,
      idempotency: c.idempotency,
      authenticate,
      rateLimit: c.rateLimiter.middleware('commands', limits.commandsMax, (req) => req.principal?.userId ?? null),
      bodyLimitBytes: c.config.bodyLimits.commandBytes,
    }),
  );

  app.use(express.json({ limit: c.config.bodyLimits.jsonBytes }));

  app.use('/v1/auth', authLimit);
  app.use('/v1/consent/user-data/jobs', authLimit);
  app.use(authModule(c.auth));
  app.use(usersModule(c.users, compose(authenticated)));
  app.use(appGrantsModule(c.grants, compose(authenticated)));
  app.use(
    consentModule({
      consent: c.consent,
      deletion: c.deletion,
      authenticate: compose(authenticated),
      authenticateAllowingPendingDeletion: compose([authenticateRequest(c.auth, { allowPendingDeletion: true }), perUser]),
    }),
  );
  app.use(telemetryModule(c.telemetry, compose(authenticated)));
  app.use(billingModule(c.billing, compose(authenticated)));
  app.use(vocabularyModule(c.vocabulary, compose(authenticated)));
  app.use(phrasesModule);
  app.use(adminModule({ adminAuth: c.adminAuth, admin: c.admin, audit: c.audit }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function compose(handlers: express.RequestHandler[]): express.RequestHandler {
  const router = express.Router({ mergeParams: true });
  router.use(...handlers);
  return router;
}
