import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { AppErrorFilter } from './common/errors/error.filter';
import { requestId } from './common/http/request-id';
import { ZodValidationPipe } from './common/validation/zod';
import { ConfigModule } from './config/config.module';
import type { Env } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { PlacesModule } from './places/places.module';
import { UsersModule } from './users/users.module';

/**
 * Root of the modular monolith. Feature modules map to Voya domains; B0 ships
 * Health, Auth (verification), Users (identity mapping) and Places (read-only
 * catalogue). Plans, Invitations, Membership, Activities and Notifications are
 * added as modules when their milestones start — see docs/backend.md.
 */
@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: requestId,
            customProps: () => ({ env: env.APP_ENV }),
            // Never log credentials or cookies.
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
              censor: '[redacted]',
            },
            autoLogging: { ignore: (req) => req.url === '/health' },
            customLogLevel: (_req, res, err) =>
              err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
            transport: env.LOG_PRETTY ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
          },
        }),
        DatabaseModule,
        AuthModule,
        HealthModule,
        UsersModule,
        PlacesModule,
      ],
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: AppErrorFilter },
      ],
    };
  }
}
