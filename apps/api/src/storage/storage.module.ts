import { Global, Module } from '@nestjs/common';
import { StorageClient } from './storage.client';

@Global()
@Module({ providers: [StorageClient], exports: [StorageClient] })
export class StorageModule {}
