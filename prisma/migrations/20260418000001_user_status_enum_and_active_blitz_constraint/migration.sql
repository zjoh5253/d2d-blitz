-- Migration: DDB-29 + DDB-28
-- DDB-29: Convert User.status from String to UserStatus enum
-- DDB-28: Add partial unique index enforcing one active blitz assignment per rep

-- ─── DDB-29: Create UserStatus enum and migrate column ────────────────────────

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Cast existing string values to the new enum type.
-- Any row with a status other than 'ACTIVE' or 'INACTIVE' will fail here;
-- clean up orphaned values before running in production.
ALTER TABLE "users"
  ALTER COLUMN "status" TYPE "UserStatus"
  USING "status"::"UserStatus";

ALTER TABLE "users"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"UserStatus";

-- ─── DDB-28: Partial unique index — one active blitz assignment per rep ────────
--
-- "Active" means any status that is not a terminal state (DEPARTED or REMOVED).
-- This enforces the business rule at the DB level rather than relying solely on
-- application-layer checks.

CREATE UNIQUE INDEX "blitz_assignments_one_active_per_rep"
  ON "blitz_assignments" ("rep_id")
  WHERE "status" NOT IN ('DEPARTED', 'REMOVED');
