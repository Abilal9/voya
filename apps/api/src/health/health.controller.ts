import { Controller, Get, HttpCode, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { HealthResponse } from '@voya/contracts';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

/**
 * Unversioned, unauthenticated probes.
 * - GET /health        liveness: the process is up (Railway healthcheck).
 * - GET /health/ready  readiness: database reachable and migrations applied; 503 otherwise.
 */
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(200)
  live(): HealthResponse {
    return this.health.live();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.ready();
    res.status(result.status === 'ok' ? 200 : 503);
    return result;
  }
}
