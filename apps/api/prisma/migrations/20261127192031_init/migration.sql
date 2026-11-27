-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('profile', 'interests', 'location', 'notifications', 'done');

-- CreateEnum
CREATE TYPE "PlaceCategory" AS ENUM ('Food', 'Coffee', 'Dessert', 'Activities', 'Culture', 'Shopping', 'Nature', 'Nightlife', 'Experiences');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('trip', 'hangout', 'event');

-- CreateEnum
CREATE TYPE "PlanLifecycle" AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PlanRole" AS ENUM ('organizer', 'co-organizer', 'traveler', 'participant', 'host', 'co-host', 'guest');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'suggestion.create', 'vote.cast', 'timeline.finalize', 'schedule.edit', 'rsvp.own');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID,
    "seed_ref" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "display_name" TEXT NOT NULL,
    "city" TEXT,
    "bio" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboarding_step" "OnboardingStep" NOT NULL DEFAULT 'profile',
    "avatar_path" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" UUID NOT NULL,
    "seed_ref" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'fixture',
    "provider_ref" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "category" "PlaceCategory" NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "rating" REAL,
    "price" TEXT,
    "photo" TEXT,
    "reason" TEXT,
    "description" TEXT,
    "hours_text" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "open_now" BOOLEAN,
    "permanently_closed" BOOLEAN,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "seed_ref" TEXT,
    "type" "PlanType" NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lifecycle" "PlanLifecycle" NOT NULL DEFAULT 'active',
    "owner_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "start_date" DATE,
    "end_date" DATE,
    "cover_path" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_members" (
    "plan_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "role" "PlanRole" NOT NULL,
    "capabilities" "Capability"[],
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_members_pkey" PRIMARY KEY ("plan_id","profile_id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "role" "PlanRole" NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_entries" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "actor_id" UUID,
    "plan_id" UUID,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_seed_ref_key" ON "profiles"("seed_ref");

-- CreateIndex
CREATE UNIQUE INDEX "places_seed_ref_key" ON "places"("seed_ref");

-- CreateIndex
CREATE INDEX "places_city_category_idx" ON "places"("city", "category");

-- CreateIndex
CREATE UNIQUE INDEX "places_provider_provider_ref_key" ON "places"("provider", "provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "plans_seed_ref_key" ON "plans"("seed_ref");

-- CreateIndex
CREATE INDEX "plans_owner_id_idx" ON "plans"("owner_id");

-- CreateIndex
CREATE INDEX "plans_type_lifecycle_idx" ON "plans"("type", "lifecycle");

-- CreateIndex
CREATE INDEX "plan_members_profile_id_idx" ON "plan_members"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_plan_id_idx" ON "invitations"("plan_id");

-- CreateIndex
CREATE INDEX "activity_entries_recipient_id_created_at_idx" ON "activity_entries"("recipient_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_members" ADD CONSTRAINT "plan_members_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_members" ADD CONSTRAINT "plan_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Voya: lock the app tables away from Supabase's Data API roles. The mobile
-- app reaches data only through the NestJS API, which connects as the owner
-- (RLS does not apply to the owner). RLS on with no policies = anon and
-- authenticated see nothing, even if a GRANT is added by mistake later.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "places" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_entries" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON "profiles", "places", "plans", "plan_members", "invitations", "activity_entries" FROM %I', r);
    END IF;
  END LOOP;
END $$;
