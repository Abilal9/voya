import { mockServices } from '@/mocks/services';
import type { Services } from './contracts';

/**
 * Composition root.
 *
 * The single place that decides which implementation backs the app. Swapping to
 * the real NestJS client later is a change HERE, not in any screen.
 *
 *   export const services: Services = __DEV_MOCKS__ ? mockServices : apiServices;
 */
export const services: Services = mockServices;

export * from './contracts';
export * from './types';
