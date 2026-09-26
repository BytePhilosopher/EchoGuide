import 'dotenv/config';
import { ConfigError, parseConfig, type AppConfig } from '../shared/config';
import { describeError, logStructured } from '../shared/logger';
import { waitForRedis } from '../shared/redis/client';
import { createApp } from './app';
import { createContainer } from './container';
import { Worker } from './worker';

function loadConfigOrExit(): AppConfig {
  try {
    return parseConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      // Variable names and rules only; values are never printed.
      console.error(JSON.stringify({ event: 'api.config_invalid', issues: error.issues }));
      process.exit(1);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const config = loadConfigOrExit();
  const container = createContainer(config);

  // Authentication needs Postgres, so an unreachable database is a failed start, not a degraded one.
  try {
    await container.pool.query('SELECT 1');
  } catch (error) {
    logStructured('api.database_unreachable', describeError(error));
    process.exit(1);
  }

  if (!(await waitForRedis(container.redis, 5000))) {
    // Failure table: Redis down degrades (no rate limiting, no idempotency, no telemetry buffer).
    logStructured('api.redis_unavailable_at_start');
  }

  const worker = config.worker.enabled ? new Worker(container) : null;
  worker?.start();

  const server = createApp(container).listen(config.port, config.host, () => {
    logStructured('api.started', { host: config.host, port: config.port, env: config.env, billing_mode: config.billing.mode, storage_driver: config.storage.driver });
  });
  // Longer than the slowest command (8 s transcription + 6 s planning), shorter than a proxy timeout.
  server.requestTimeout = 30_000;
  server.headersTimeout = 20_000;
  server.keepAliveTimeout = 65_000;

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logStructured('api.stopping', { signal });
    const force = setTimeout(() => process.exit(1), 25_000);
    force.unref();
    server.close(() => {
      void (worker?.stop() ?? Promise.resolve())
        .then(() => container.close())
        .then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logStructured('api.start_failed', describeError(error));
  process.exit(1);
});
