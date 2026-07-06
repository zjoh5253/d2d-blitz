import { db } from "@/lib/db";
import {
  resolveHoldbackPolicy,
  splitHoldback,
  upsertHoldback,
} from "@/lib/services/holdback";
import { upsertOverrideEarnings } from "@/lib/services/override-earning";
import { resolveRepOverride } from "@/lib/services/rep-commission";
import { applyRateSheets } from "@/lib/services/rate-sheet";

export async function calculateCommission(saleId: string) {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      carrier: true,
      product: true,
      blitz: { include: { market: true } },
      rep: { include: { governanceTier: true } },
    },
  });

  if (!sale) throw new Error("Sale not found");
  if (sale.status !== "VERIFIED") throw new Error("Sale must be verified");

  // Resolve the most specific active rate sheet: product+market → product →
  // market → carrier-wide. `nulls: last` puts specific (non-null) configs first.
  const productFilter = sale.productId
    ? { OR: [{ productId: sale.productId }, { productId: null }] }
    : { productId: null };
  const stackConfig = await db.stackConfig.findFirst({
    where: {
      carrierId: sale.carrierId,
      effectiveDate: { lte: sale.submittedAt },
      AND: [
        productFilter,
        { OR: [{ marketId: sale.blitz.marketId }, { marketId: null }] },
      ],
    },
    orderBy: [
      { productId: { sort: "desc", nulls: "last" } },
      { marketId: { sort: "desc", nulls: "last" } },
      { effectiveDate: "desc" },
    ],
  });

  if (!stackConfig) throw new Error("No stack configuration found");

  // Product revenue takes precedence; fall back to the carrier default.
  const carrierPayout = sale.product?.revenue ?? sale.carrier.revenuePerInstall;
  const baselineCompanyFloor = carrierPayout * stackConfig.companyFloorPercent;
  const remaining = carrierPayout - baselineCompanyFloor;
  const baselineManagerOverride = remaining * stackConfig.managerOverridePercent;
  const baselineMarketOwnerSpread = remaining * stackConfig.marketOwnerSpreadPercent;
  let repPay = remaining - baselineManagerOverride - baselineMarketOwnerSpread;

  // A custom per-rep override, when present, replaces the computed pay outright
  // (the governance-tier multiplier is bypassed). Otherwise apply the tier.
  const repOverride = await resolveRepOverride({
    repId: sale.repId,
    carrierId: sale.carrierId,
    productId: sale.productId,
    at: sale.submittedAt,
  });
  if (repOverride) {
    repPay = repOverride.amount;
  } else {
    const tierMultiplier = sale.rep.governanceTier?.commissionMultiplier ?? 1.0;
    repPay *= tierMultiplier;
  }

  // Overlay the hierarchical rate-sheet chain: when an owner/manager grant
  // resolves, derive the slices down the chain; otherwise keep the baseline.
  const { companyFloor, managerOverride, marketOwnerSpread } = await applyRateSheets({
    carrierPayout,
    baselineCompanyFloor,
    baselineManagerOverride,
    baselineMarketOwnerSpread,
    repPay,
    managerId: sale.blitz.managerId,
    ownerId: sale.blitz.market.ownerId,
    carrierId: sale.carrierId,
    productId: sale.productId,
    at: sale.submittedAt,
  });

  // Hold back a slice of the rep's pay for the retention period. The immediate
  // portion is what flows through the normal payout pipeline now; the held
  // portion is tracked in the Holdback ledger and paid later as a retention bonus.
  const policy = await resolveHoldbackPolicy(sale.carrierId, sale.submittedAt);
  const { immediate, held, percent, releaseAt } = splitHoldback(
    repPay,
    policy,
    sale.submittedAt
  );

  const record = await db.commissionRecord.upsert({
    where: { saleId: sale.id },
    create: {
      saleId: sale.id,
      repId: sale.repId,
      blitzId: sale.blitzId,
      carrierPayout,
      companyFloor,
      managerOverride,
      repPay: immediate,
      marketOwnerSpread,
      status: "ELIGIBLE",
      governanceTierId: sale.rep.governanceTierId,
      productId: sale.productId,
      repCommissionOverrideId: repOverride?.id ?? null,
    },
    update: {
      carrierPayout,
      companyFloor,
      managerOverride,
      repPay: immediate,
      marketOwnerSpread,
      governanceTierId: sale.rep.governanceTierId,
      productId: sale.productId,
      repCommissionOverrideId: repOverride?.id ?? null,
    },
  });

  if (held > 0) {
    await upsertHoldback({
      commissionRecordId: record.id,
      repId: sale.repId,
      carrierId: sale.carrierId,
      amount: held,
      percent,
      releaseAt,
    });
  }

  // The override slices are payable to the blitz's manager and the market owner.
  await upsertOverrideEarnings({
    commissionRecordId: record.id,
    managerId: sale.blitz.managerId,
    ownerId: sale.blitz.market.ownerId,
    managerOverride,
    marketOwnerSpread,
  });

  return record;
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
