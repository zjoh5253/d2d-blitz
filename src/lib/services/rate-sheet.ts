import { db } from "@/lib/db";

type Level = "OWNER" | "MANAGER";

/**
 * Resolve the available-revenue grant for a principal (owner or manager) at a
 * level, for a sale's carrier/product. Most-specific active grant wins
 * (product > carrier > global, newest effective). Returns the dollar amount or
 * null when the principal has no grant (→ the baseline split is used).
 */
export async function resolveRateSheet(params: {
  level: Level;
  principalId: string;
  carrierId: string;
  productId?: string | null;
  at: Date;
}): Promise<number | null> {
  const sheet = await db.rateSheet.findFirst({
    where: {
      level: params.level,
      principalId: params.principalId,
      active: true,
      effectiveDate: { lte: params.at },
      AND: [
        params.productId
          ? { OR: [{ productId: params.productId }, { productId: null }] }
          : { productId: null },
        { OR: [{ carrierId: params.carrierId }, { carrierId: null }] },
      ],
    },
    orderBy: [
      { productId: { sort: "desc", nulls: "last" } },
      { carrierId: { sort: "desc", nulls: "last" } },
      { effectiveDate: "desc" },
    ],
    select: { availableRevenue: true },
  });
  return sheet?.availableRevenue ?? null;
}

export type DerivedSlices = {
  companyFloor: number;
  managerOverride: number;
  marketOwnerSpread: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Overlay the hierarchical rate-sheet chain onto the baseline slices. When
 * neither the manager nor the owner has a grant, the baseline is returned
 * unchanged (zero behavior change). Otherwise the slices are derived down the
 * chain: managerOverride = managerAvailable − repPay, marketOwnerSpread =
 * ownerAvailable − managerAvailable, companyFloor = carrierPayout − ownerAvailable.
 */
export async function applyRateSheets(params: {
  carrierPayout: number;
  baselineCompanyFloor: number;
  baselineManagerOverride: number;
  baselineMarketOwnerSpread: number;
  repPay: number;
  managerId: string;
  ownerId: string;
  carrierId: string;
  productId?: string | null;
  at: Date;
}): Promise<DerivedSlices> {
  const [managerSheet, ownerSheet] = await Promise.all([
    resolveRateSheet({
      level: "MANAGER",
      principalId: params.managerId,
      carrierId: params.carrierId,
      productId: params.productId,
      at: params.at,
    }),
    resolveRateSheet({
      level: "OWNER",
      principalId: params.ownerId,
      carrierId: params.carrierId,
      productId: params.productId,
      at: params.at,
    }),
  ]);

  if (managerSheet === null && ownerSheet === null) {
    return {
      companyFloor: params.baselineCompanyFloor,
      managerOverride: params.baselineManagerOverride,
      marketOwnerSpread: params.baselineMarketOwnerSpread,
    };
  }

  const managerAvailable = managerSheet ?? params.repPay + params.baselineManagerOverride;
  const ownerAvailable = ownerSheet ?? managerAvailable + params.baselineMarketOwnerSpread;

  return {
    managerOverride: round(Math.max(0, managerAvailable - params.repPay)),
    marketOwnerSpread: round(Math.max(0, ownerAvailable - managerAvailable)),
    companyFloor: round(Math.max(0, params.carrierPayout - ownerAvailable)),
  };
}
