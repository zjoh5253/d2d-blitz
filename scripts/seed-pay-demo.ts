import "dotenv/config"; // load DATABASE_URL before db client is constructed (tsx doesn't auto-load .env)
import { db } from "../src/lib/db";

// Seeds sample commission + payout data so the rep "My Pay" screen
// (/rep/pay) shows fully populated. LOCAL DEV ONLY — it writes to whatever
// DATABASE_URL points at, so run it against your local Postgres, not prod.
//
//   Seed:    npx tsx scripts/seed-pay-demo.ts
//   Target a specific rep: REP_EMAIL=rep1@d2dblitz.com npx tsx scripts/seed-pay-demo.ts
//   Clean up: npx tsx scripts/seed-pay-demo.ts --clean
//
// Everything it creates is tagged with MARKER so --clean removes it cleanly
// and nothing real is touched.

const MARKER = "SEED-PAYDEMO";
const CLEAN = process.argv.includes("--clean");

async function clean() {
  const demoSales = await db.sale.findMany({ where: { orderConfirmation: MARKER }, select: { id: true } });
  const saleIds = demoSales.map((s) => s.id);
  const batches = await db.payoutBatch.findMany({ where: { period: { startsWith: MARKER } }, select: { id: true } });
  const batchIds = batches.map((b) => b.id);

  if (batchIds.length) await db.payoutLine.deleteMany({ where: { batchId: { in: batchIds } } });
  if (batchIds.length) await db.payoutBatch.deleteMany({ where: { id: { in: batchIds } } });
  if (saleIds.length) await db.commissionRecord.deleteMany({ where: { saleId: { in: saleIds } } });
  if (saleIds.length) await db.sale.deleteMany({ where: { id: { in: saleIds } } });
  console.log(`Cleaned: ${saleIds.length} demo sales, ${batchIds.length} demo payout batches (+ their lines/commissions).`);
}

async function seed() {
  // 1. Pick a rep (by REP_EMAIL, else the first FIELD_REP).
  const repEmail = process.env.REP_EMAIL;
  const rep = repEmail
    ? await db.user.findUnique({ where: { email: repEmail } })
    : await db.user.findFirst({ where: { role: "FIELD_REP" } });
  if (!rep) {
    throw new Error("No FIELD_REP found. Run the base seed first (npm run db:seed), or set REP_EMAIL.");
  }

  // 2. Find a blitz for this rep (an assignment, else any blitz), and the carrier behind it.
  const assignment = await db.blitzAssignment.findFirst({
    where: { repId: rep.id },
    include: { blitz: { include: { market: { include: { carrier: true } } } } },
  });
  const blitz =
    assignment?.blitz ??
    (await db.blitz.findFirst({ include: { market: { include: { carrier: true } } } }));
  if (!blitz) throw new Error("No blitz found. Run the base seed first (npm run db:seed).");
  const carrier = blitz.market.carrier;
  const tier = await db.governanceTier.findFirst({ where: { isDefault: true } }).then(
    (t) => t ?? db.governanceTier.findFirst()
  );

  const rev = carrier.revenuePerInstall || 400;
  const repPay = Math.round(rev * 0.55);

  // 3. Create sample sales + commissions across the status spectrum.
  // status here is the COMMISSION status, so the rep sees pending/paid/on-hold.
  const plan: { name: string; status: "PAID" | "PENDING" | "ELIGIBLE" | "ON_HOLD"; daysAgo: number }[] = [
    { name: "Demo — A. Rivera", status: "PAID", daysAgo: 40 },
    { name: "Demo — B. Chen", status: "PAID", daysAgo: 38 },
    { name: "Demo — C. Okafor", status: "PENDING", daysAgo: 12 },
    { name: "Demo — D. Nguyen", status: "PENDING", daysAgo: 10 },
    { name: "Demo — E. Patel", status: "ELIGIBLE", daysAgo: 4 },
    { name: "Demo — F. Sosa", status: "ELIGIBLE", daysAgo: 2 },
    { name: "Demo — G. Brooks", status: "ON_HOLD", daysAgo: 6 },
  ];

  const created: { id: string; status: string }[] = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const when = new Date();
    when.setDate(when.getDate() - p.daysAgo);
    const sale = await db.sale.create({
      data: {
        repId: rep.id,
        blitzId: blitz.id,
        carrierId: carrier.id,
        customerName: p.name,
        customerPhone: "555-0100",
        customerAddress: `${100 + i} Demo St, Sampleton, TX 78000`,
        installDate: when,
        orderConfirmation: MARKER,
        status: "VERIFIED",
        submittedAt: when,
      },
    });
    const commission = await db.commissionRecord.create({
      data: {
        saleId: sale.id,
        repId: rep.id,
        blitzId: blitz.id,
        carrierPayout: rev,
        companyFloor: Math.round(rev * 0.12),
        managerOverride: Math.round(rev * 0.1),
        marketOwnerSpread: Math.round(rev * 0.08),
        repPay,
        status: p.status,
        governanceTierId: tier?.id ?? null,
        createdAt: when,
      },
    });
    created.push({ id: commission.id, status: p.status });
  }

  // 4. A PAID payout batch + line so the rep's payout history is populated.
  const paidCount = plan.filter((p) => p.status === "PAID").length;
  const gross = repPay * paidCount;
  const deductions = 75;
  const batch = await db.payoutBatch.create({
    data: { period: `${MARKER} 2026-04`, status: "PAID", approvedAt: new Date() },
  });
  await db.payoutLine.create({
    data: {
      batchId: batch.id,
      repId: rep.id,
      grossPay: gross,
      totalDeductions: deductions,
      netPay: gross - deductions,
      complianceVerified: true,
      governanceChecked: true,
    },
  });

  const byStatus = created.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Seeded for rep "${rep.name ?? rep.id}" (${rep.id}):`);
  console.log(`  ${created.length} commissions:`, byStatus);
  console.log(`  repPay each: $${repPay} | 1 PAID payout batch ($${gross - deductions} net)`);
  console.log(`  blitz: ${blitz.name} | carrier: ${carrier.name}`);
  console.log(`\nLog in as that rep and open /rep/pay. Remove later with: npx tsx scripts/seed-pay-demo.ts --clean`);
}

(CLEAN ? clean() : seed())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
