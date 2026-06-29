// Fiber Blitz OS v2 — rep qualification matcher (spec §6.1 match criteria).
//
// Single source of truth for "which reps qualify for a blitz", used by the
// create-form qualified-count preview now and the targeted invite engine
// (Sprint 2) later. Pure where-builder so both call sites stay in sync.
//
// Spec criteria: availability overlaps dates · carrier credentials current ·
// readiness score >= blitz minimum · status active. (Preferred market is a
// RANKING hint, not a filter.) Credential/availability data is captured at
// onboarding (Sprint 7); until reps carry it, those clauses are best-effort
// no-ops and we qualify on score + active status — documented below.

import { Prisma } from "@prisma/client";

export interface QualFilters {
  minScore?: number | null;
  // Reserved for when onboarding populates rep credentials/availability:
  carrierCredential?: string | null;
  experienceMonths?: number | null;
}

/**
 * Prisma `where` selecting reps that qualify. Always restricts to active field
 * reps; adds a readiness-score floor when the blitz sets one.
 */
export function qualifiedRepWhere(f: QualFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    role: "FIELD_REP",
    status: "ACTIVE",
  };
  if (f.minScore != null) {
    // Reps without a computed score yet are seeded to the Standard default, so
    // a Standard-or-below minimum still includes them.
    where.blitzReadinessScore = { gte: f.minScore };
  }
  // TODO(sprint7): once reps carry carrier_credentials (with expiry) and
  // availability_calendar, AND those clauses here: credential current through
  // the blitz end date, and no blackout overlapping the blitz dates.
  return where;
}
