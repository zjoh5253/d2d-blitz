-- Cached Kinetic (gokinetic.com) per-address availability results.
-- Additive + idempotent. New table only — safe against the drifted prod
-- schema. Reviewed migration, NOT `prisma db push`.

CREATE TABLE IF NOT EXISTS "kinetic_address_status" (
  "id"                text PRIMARY KEY,
  "address_key"       text NOT NULL,
  "serviceable"       boolean NOT NULL DEFAULT false,
  "isCustomer"        boolean NOT NULL DEFAULT false,
  "comingSoon"        boolean NOT NULL DEFAULT false,
  "validation_result" text,
  "max_qual"          text,
  "tech_type"         text,
  "billing_status"    text,
  "est_completion_dt" text,
  "raw"               text,
  "checked_at"        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "kinetic_address_status_address_key_key"
  ON "kinetic_address_status" ("address_key");
CREATE INDEX IF NOT EXISTS "kinetic_address_status_isCustomer_idx"
  ON "kinetic_address_status" ("isCustomer");
CREATE INDEX IF NOT EXISTS "kinetic_address_status_serviceable_idx"
  ON "kinetic_address_status" ("serviceable");
CREATE INDEX IF NOT EXISTS "kinetic_address_status_checked_at_idx"
  ON "kinetic_address_status" ("checked_at");
