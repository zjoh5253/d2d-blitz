-- Rep attribution on install records: credit installs to the rep named in the
-- carrier report, without needing a matched Sale. Additive + idempotent.

ALTER TABLE "install_records" ADD COLUMN IF NOT EXISTS "rep_name" text;
ALTER TABLE "install_records" ADD COLUMN IF NOT EXISTS "rep_id" text;

CREATE INDEX IF NOT EXISTS "install_records_rep_id_idx"
  ON "install_records" ("rep_id");
CREATE INDEX IF NOT EXISTS "install_records_carrier_id_external_id_idx"
  ON "install_records" ("carrier_id", "external_id");
