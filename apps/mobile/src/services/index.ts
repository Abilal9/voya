import { createRealServices } from '@/api';
import { runtimeConfig } from '@/config/runtime';
import { localAccountBridge } from '@/mocks/localAccount';
import { mockServices } from '@/mocks/services';
import type { Services } from './contracts';

/**
 * Composition root.
 *
 * The single place that decides which implementation backs the app (see
 * src/config/runtime.ts):
 *   - mock:     everything is local fixtures + AsyncStorage (development only)
 *   - supabase: auth, profile, plans, invitations and the people catalogue
 *               are real (Supabase Auth + Voya API); saves, activity and
 *               Explore are still mocks acting as the real account (B2)
 * Screens never know which one they talk to.
 */
export const services: Services =
  runtimeConfig.authProvider === 'supabase'
    ? createRealServices(runtimeConfig, mockServices, localAccountBridge)
    : mockServices;

export * from './contracts';
export * from './types';
