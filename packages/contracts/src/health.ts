import { z } from 'zod';

export const HealthCheckStatusSchema = z.enum(['up', 'down']);

/** GET /health (liveness) and GET /health/ready (readiness). */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  service: z.literal('voya-api'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  checks: z.record(
    z.object({
      status: HealthCheckStatusSchema,
      latencyMs: z.number().nonnegative().optional(),
      /** Safe, generic reason; never a connection string or driver message. */
      reason: z.string().optional(),
    }),
  ).optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
