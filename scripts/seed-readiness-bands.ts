// Fiber Blitz OS v2 — seed existing reps to the Standard band entry default.
//
// Spec §8.2: reps start at 75 / Standard and prove out. This backfills every
// FIELD_REP that has no band yet so the score-band board gate (once enabled)
// never locks out a current rep by surprise. Idempotent: only touches reps
// where score_band IS NULL. New reps get the default wired into onboarding.
//
// Local: `npx tsx scripts/seed-readiness-bands.ts`
// Prod (later, deliberate): `npx tsx scripts/seed-readiness-bands.ts --prod`
//   — requires the migrations to be applied to prod first.

import { db } from "../src/lib/db";
import { DEFAULT_SCORE, DEFAULT_BAND } from "../src/lib/readiness-score";

const isProd = process.argv.includes("--prod");

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!isProd && /neon\.tech|amazonaws/.test(url)) {
    throw new Error("DATABASE_URL looks like prod but --prod was not passed. Aborting.");
  }

  const res = await db.user.updateMany({
    where: { role: "FIELD_REP", scoreBand: null },
    data: { blitzReadinessScore: DEFAULT_SCORE, scoreBand: DEFAULT_BAND },
  });
  console.log(`Seeded ${res.count} rep(s) to ${DEFAULT_BAND} (${DEFAULT_SCORE}).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
