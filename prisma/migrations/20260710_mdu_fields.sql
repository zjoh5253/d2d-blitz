-- MDU (apartment) model P1: capture complexes as leasing-office leads + unit count.
ALTER TABLE door_knock_leads ADD COLUMN IF NOT EXISTS is_mdu BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE door_knock_leads ADD COLUMN IF NOT EXISTS unit_count INTEGER;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS units_sold INTEGER NOT NULL DEFAULT 1;
