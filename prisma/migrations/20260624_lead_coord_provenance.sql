-- Coordinate provenance for door-knock leads.
-- Additive + idempotent. Reviewed migration, NOT `prisma db push`.
--
-- When a rep dispositions a door, their phone GPS (if a good fix, and close to
-- the existing pin) overwrites lat/lng in place — the rep at the door is the
-- most accurate source we have. These columns record that:
--
-- coord_source:      where the current lat/lng came from. "rep_gps" once a rep
--                    has verified the pin in the field; otherwise the import
--                    source. Lets a bulk re-import skip rep-verified pins.
-- coords_updated_at: when lat/lng was last set from a rep GPS fix.

ALTER TABLE "door_knock_leads"
  ADD COLUMN IF NOT EXISTS "coord_source"      text,
  ADD COLUMN IF NOT EXISTS "coords_updated_at" timestamp(3);
