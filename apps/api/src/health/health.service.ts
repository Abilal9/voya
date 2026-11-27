import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@voya/contracts';
import { PrismaService } from '../database/prisma.service';

type Check = NonNullable<HealthResponse['checks']>[string];

const DB_TIMEOUT_MS = 2000;

/** Package version, read once (Railway shows it in health output). */
const VERSION: string = process.env.npm_package_version ?? '0.1.0';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live(): HealthResponse {
    return this.base('ok');
  }

  async ready(): Promise<HealthResponse> {
    const [database, migrations] = await Promise.all([this.checkDatabase(), this.checkMigrations()]);
    const checks = { database, migrations };
    const ok = Object.values(checks).every((check) => check.status === 'up');
    return { ...this.base(ok ? 'ok' : 'error'), checks };
  }

  private base(status: HealthResponse['status']): HealthResponse {
    return { status, service: 'voya-api', version: VERSION, uptimeSeconds: Math.round(process.uptime()) };
  }

  private async checkDatabase(): Promise<Check> {
    const started = Date.now();
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - started };
    } catch {
      return { status: 'down', latencyMs: Date.now() - started, reason: 'Database is not reachable' };
    }
  }

  /** Ready only when every migration has been applied and none failed. */
  private async checkMigrations(): Promise<Check> {
    try {
      const rows = await withTimeout(
        this.prisma.$queryRaw<{ pending: bigint }[]>`
          SELECT count(*) AS pending FROM "_prisma_migrations"
          WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
        DB_TIMEOUT_MS,
      );
      const pending = Number(rows[0]?.pending ?? 0);
      return pending === 0 ? { status: 'up' } : { status: 'down', reason: 'A migration has not finished' };
    } catch {
      return { status: 'down', reason: 'Migrations have not been applied' };
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
