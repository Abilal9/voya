-- CreateTable
CREATE TABLE "account_settings" (
    "profile_id" UUID NOT NULL,
    "notifications" JSONB NOT NULL DEFAULT '{}',
    "precise_location" BOOLEAN NOT NULL DEFAULT true,
    "discovery_radius_km" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_settings_pkey" PRIMARY KEY ("profile_id")
);

-- AddForeignKey
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Voya: same bounds the API validates (DISCOVERY_RADIUS_KM in @voya/contracts).
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_discovery_radius_km_check"
  CHECK ("discovery_radius_km" BETWEEN 1 AND 50);
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_notifications_object_check"
  CHECK (jsonb_typeof("notifications") = 'object');

-- Voya: RLS on, no policies, no Data API grants (see the init migration).
ALTER TABLE "account_settings" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON "account_settings" FROM %I', r);
    END IF;
  END LOOP;
END $$;
