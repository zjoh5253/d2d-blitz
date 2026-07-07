// Fiber Blitz OS v2 — seed a starter comp-tier library so the create form's
// compensation selector isn't empty. Idempotent: skips tiers that already exist
// by name. Edit/replace these with real numbers once finance confirms them.
//
// Local: `npx tsx -r dotenv/config scripts/seed-comp-tiers.ts`

import { db } from "../src/lib/db";

const TIERS = [
  { name: "Standard — $100/install", baseCommission: 10000, travelNotes: "Company-fronted travel + lodging." },
  { name: "Premium — $150/install", baseCommission: 15000, travelNotes: "Company-fronted travel + lodging; top-tier markets." },
  { name: "Rep-fronted — $175/install", baseCommission: 17500, travelNotes: "Rep fronts travel, reimbursed up to cap on completion." },
];

async function main() {
  let created = 0;
  for (const t of TIERS) {
    const exists = await db.compTier.findFirst({ where: { name: t.name } });
    if (exists) continue;
    await db.compTier.create({ data: t });
    created++;
  }
  console.log(`Seeded ${created} comp tier(s) (${TIERS.length - created} already present).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
