-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'maybe', 'declined');

-- AlterTable
ALTER TABLE "plan_members" ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "plan_invitees" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "invited_by_id" UUID,
    "invited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(3),
    "invitation_id" UUID,
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plan_invitees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_invitees_profile_id_idx" ON "plan_invitees"("profile_id");

-- CreateIndex
CREATE INDEX "plan_invitees_invitation_id_idx" ON "plan_invitees"("invitation_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_invitees_plan_id_profile_id_key" ON "plan_invitees"("plan_id", "profile_id");

-- AddForeignKey
ALTER TABLE "plan_invitees" ADD CONSTRAINT "plan_invitees_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_invitees" ADD CONSTRAINT "plan_invitees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_invitees" ADD CONSTRAINT "plan_invitees_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_invitees" ADD CONSTRAINT "plan_invitees_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Voya: RLS on, no policies, no Data API grants (see the init migration).
ALTER TABLE "plan_invitees" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON "plan_invitees" FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- Voya: plan documents keep their type-specific state as a JSON object.
ALTER TABLE "plans" ADD CONSTRAINT "plans_details_object_check" CHECK (jsonb_typeof("details") = 'object');
ALTER TABLE "plans" ADD CONSTRAINT "plans_version_positive_check" CHECK ("version" >= 1);
