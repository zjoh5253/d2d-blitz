import { db } from "@/lib/db";

export async function calculateCommission(saleId: string) {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      carrier: true,
      blitz: { include: { market: true } },
      rep: { include: { governanceTier: true } },
    },
  });

  if (!sale) throw new Error("Sale not found");
  if (sale.status !== "VERIFIED") throw new Error("Sale must be verified");

  // Get active stack config for this carrier/market
  const stackConfig = await db.stackConfig.findFirst({
    where: {
      carrierId: sale.carrierId,
      OR: [
        { marketId: sale.blitz.marketId },
        { marketId: null },
      ],
      effectiveDate: { lte: sale.submittedAt },
    },
    orderBy: [
      { marketId: "desc" }, // Prefer market-specific config
      { effectiveDate: "desc" },
    ],
  });

  if (!stackConfig) throw new Error("No stack configuration found");

  const carrierPayout = sale.carrier.revenuePerInstall;
  const companyFloor = carrierPayout * stackConfig.companyFloorPercent;
  const remaining = carrierPayout - companyFloor;
  const managerOverride = remaining * stackConfig.managerOverridePercent;
  const marketOwnerSpread = remaining * stackConfig.marketOwnerSpreadPercent;
  let repPay = remaining - managerOverride - marketOwnerSpread;

  // Apply governance tier multiplier
  const tierMultiplier = sale.rep.governanceTier?.commissionMultiplier ?? 1.0;
  repPay *= tierMultiplier;

  return db.commissionRecord.upsert({
    where: { saleId: sale.id },
    create: {
      saleId: sale.id,
      repId: sale.repId,
      blitzId: sale.blitzId,
      carrierPayout,
      companyFloor,
      managerOverride,
      repPay,
      marketOwnerSpread,
      status: "ELIGIBLE",
      governanceTierId: sale.rep.governanceTierId,
    },
    update: {
      carrierPayout,
      companyFloor,
      managerOverride,
      repPay,
      marketOwnerSpread,
      governanceTierId: sale.rep.governanceTierId,
    },
  });
}

export async function calculateAllPendingCommissions() {
  const verifiedSales = await db.sale.findMany({
    where: {
      status: "VERIFIED",
      commissionRecord: null,
    },
  });

  const results = [];
  for (const sale of verifiedSales) {
    try {
      const record = await calculateCommission(sale.id);
      results.push({ saleId: sale.id, status: "success", record });
    } catch (error) {
      results.push({ saleId: sale.id, status: "error", error: String(error) });
    }
  }

  return results;
}
