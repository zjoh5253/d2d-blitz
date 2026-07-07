-- Partner/carrier customer-address export (e.g. Chuzo) → suppression source.
-- Additive + idempotent. New table only — safe against the drifted prod
-- schema. Reviewed migration, NOT `prisma db push`.

CREATE TABLE IF NOT EXISTS "serviced_addresses" (
  "id"          text PRIMARY KEY,
  "address_key" text NOT NULL,
  "source"      text NOT NULL,
  "raw_address" text,
  "created_at"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "serviced_addresses_address_key_key"
  ON "serviced_addresses" ("address_key");
CREATE INDEX IF NOT EXISTS "serviced_addresses_source_idx"
  ON "serviced_addresses" ("source");
