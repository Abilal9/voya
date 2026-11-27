import { type INestApplication, RequestMethod, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { REQUEST_ID_HEADER } from './common/http/request-id';
import type { Env } from './config/env';

/**
 * Builds the configured application. Shared by main.ts and the e2e tests so
 * tests exercise the same prefixes, versioning, CORS and security headers.
 *
 * Routes: `/health`, `/health/ready` (unversioned), everything else under
 * `/api/v1/...`.
 */
export async function createApp(env: Env): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    bufferLogs: true,
    abortOnError: false,
  });
  return configureApp(app, env);
}

export function configureApp(app: INestApplication, env: Env): INestApplication {
  app.useLogger(app.get(Logger));
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  if (env.TRUST_PROXY_HOPS > 0) express.set('trust proxy', env.TRUST_PROXY_HOPS);
  express.useBodyParser('json', { limit: '100kb' });

  app.use(helmet());
  app.enableCors({
    // Browser origins only; native apps send no Origin header and are unaffected.
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', REQUEST_ID_HEADER, 'if-match'],
    exposedHeaders: [REQUEST_ID_HEADER],
    credentials: false,
    maxAge: 600,
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  // Signals are handled in main.ts (bounded graceful shutdown), not here.
  return app;
}
