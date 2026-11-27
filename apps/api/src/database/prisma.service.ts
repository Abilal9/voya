import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The one PrismaClient for the process. It connects lazily on first query
 * (so the API can start, and report "not ready", while the database is down)
 * and disconnects on shutdown.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ log: [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }] });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
