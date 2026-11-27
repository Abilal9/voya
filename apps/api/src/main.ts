import { Logger } from 'nestjs-pino';
import { createApp } from './bootstrap';
import { loadEnv } from './config/env';

async function main(): Promise<void> {
  // Fails fast, listing invalid variable NAMES (never values).
  const env = loadEnv();
  const app = await createApp(env);
  const logger = app.get(Logger);

  // Graceful shutdown: stop accepting connections, let in-flight requests
  // finish (bounded), then Nest runs onModuleDestroy (Prisma disconnects).
  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    logger.log(`Shutting down on ${signal}`);
    const force = setTimeout(() => {
      logger.error('Shutdown timed out; exiting');
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    force.unref();
    app
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error(`Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  await app.listen(env.PORT, env.HOST);
  logger.log(`Voya API listening on ${env.HOST}:${env.PORT} (${env.APP_ENV})`);
}

main().catch((error: unknown) => {
  // The logger may not exist yet (e.g. invalid env), so write plainly.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
