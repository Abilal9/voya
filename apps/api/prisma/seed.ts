/**
 * Local/demo seed. Idempotent: every row is upserted by `seed_ref`, so running
 * it twice leaves the same data. Run with `pnpm --filter @voya/api db:seed`
 * (also runs after `db:reset`).
 *
 * Data comes from prisma/seed/fixtures.json, a snapshot of the mobile mock
 * fixtures (apps/mobile/src/mocks/fixtures.ts) taken in Asia/Riyadh time. The
 * API never imports the mobile mocks directly; refresh the snapshot instead.
 *
 * Seeded people have no Supabase login (auth_user_id NULL). Refuses to run
 * against a production environment.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  PersonSchema,
  PlaceSchema,
  PlanBaseSchema,
  type Capability,
  type PlanRole,
} from '@voya/contracts';
import { z } from 'zod';
import { capabilityToDb, roleToDb } from '../src/database/enums';
import fixtures from './seed/fixtures.json';
import { translatePlan } from './seed/translate';

const SeedSchema = z.object({
  people: z.array(PersonSchema),
  places: z.array(PlaceSchema),
  plans: z.array(PlanBaseSchema.passthrough()),
});

// `coverPhoto` (a fixture image key) is kept in the document; `cover_path` is for uploaded covers.
const BASE_KEYS = new Set(Object.keys(PlanBaseSchema.shape).filter((k) => k !== 'coverPhoto'));
const TRIP_DATE_KEYS = new Set(['startDate', 'endDate']);

export async function seed(prisma: PrismaClient): Promise<{ people: number; places: number; plans: number }> {
  const data = SeedSchema.parse(fixtures);
  const profileIds = new Map<string, string>();
  const placeIds = new Map<string, string>();

  for (const person of data.people) {
    const fields = {
      firstName: person.firstName,
      lastName: person.lastName ?? null,
      displayName: person.displayName,
      city: person.city ?? null,
      bio: person.bio ?? null,
      onboardingStep: 'done' as const,
    };
    const row = await prisma.profile.upsert({
      where: { seedRef: person.id },
      update: fields,
      create: { seedRef: person.id, ...fields },
    });
    profileIds.set(person.id, row.id);
  }

  for (const place of data.places) {
    const fields = {
      name: place.name,
      type: place.type ?? null,
      category: place.category,
      city: place.city,
      area: place.area ?? null,
      rating: place.rating ?? null,
      price: place.price ?? null,
      photo: place.photo ?? null,
      reason: place.reason ?? null,
      description: place.description ?? null,
      hoursText: place.hoursText ?? null,
      latitude: place.coordinates?.latitude ?? null,
      longitude: place.coordinates?.longitude ?? null,
      openNow: place.openNow ?? null,
      permanentlyClosed: place.permanentlyClosed ?? null,
      tags: place.tags ?? [],
    };
    const placeRow = await prisma.place.upsert({
      where: { seedRef: place.id },
      update: fields,
      create: { seedRef: place.id, provider: 'fixture', providerRef: place.id, ...fields },
    });
    placeIds.set(place.id, placeRow.id);
  }

  for (const plan of data.plans) {
    const ownerId = requireId(profileIds, plan.ownerId, `owner of ${plan.id}`);
    // Type-specific state (days, suggestions, schedule...) stays a document
    // until each experience gets its own tables (B3), with real ids inside;
    // invited people become rows.
    const translated = translatePlan(
      plan.type,
      Object.fromEntries(Object.entries(plan).filter(([key]) => !BASE_KEYS.has(key) && !TRIP_DATE_KEYS.has(key))),
      (ref) => requireId(profileIds, ref, `person in ${plan.id}`),
      (ref) => requireId(placeIds, ref, `place in ${plan.id}`),
    );
    const details = translated.details as Prisma.InputJsonObject;
    const extra = plan as Record<string, unknown>;
    const fields = {
      type: plan.type,
      title: plan.title,
      city: plan.city,
      lifecycle: plan.lifecycle,
      ownerId,
      startsAt: plan.startsAt ? new Date(plan.startsAt) : null,
      endsAt: plan.endsAt ? new Date(plan.endsAt) : null,
      startDate: typeof extra.startDate === 'string' ? new Date(`${extra.startDate}T00:00:00Z`) : null,
      endDate: typeof extra.endDate === 'string' ? new Date(`${extra.endDate}T00:00:00Z`) : null,
      coverPath: null,
      details,
      version: plan.version,
    };
    const row = await prisma.plan.upsert({
      where: { seedRef: plan.id },
      update: fields,
      create: { seedRef: plan.id, ...fields },
    });

    await prisma.planMember.deleteMany({ where: { planId: row.id } });
    await prisma.planMember.createMany({
      data: plan.members.map((member) => ({
        planId: row.id,
        profileId: requireId(profileIds, member.personId, `member of ${plan.id}`),
        role: roleToDb(member.role as PlanRole),
        capabilities: member.capabilities.map((c) => capabilityToDb(c as Capability)),
        joinedAt: new Date(member.joinedAt),
      })),
    });
    await prisma.planInvitee.deleteMany({ where: { planId: row.id } });
    await prisma.planInvitee.createMany({ data: translated.invitees.map((i) => ({ planId: row.id, ...i })) });
  }

  return { people: data.people.length, places: data.places.length, plans: data.plans.length };
}

function requireId(ids: Map<string, string>, ref: string, what: string): string {
  const id = ids.get(ref);
  if (!id) throw new Error(`Seed data references unknown "${ref}" (${what})`);
  return id;
}

async function main(): Promise<void> {
  const appEnv = process.env.APP_ENV ?? 'local';
  if (process.env.NODE_ENV === 'production' || appEnv === 'production' || appEnv === 'staging') {
    throw new Error(`Refusing to seed demo data into APP_ENV=${appEnv}`);
  }
  const prisma = new PrismaClient();
  try {
    const counts = await prisma.$transaction((tx) => seed(tx as PrismaClient), { timeout: 30_000 });
    console.log(`Seeded ${counts.people} people, ${counts.places} places, ${counts.plans} plans.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
