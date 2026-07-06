import { db } from "@/lib/db";
import { resolveRateSheet } from "@/lib/services/rate-sheet";

export type MinMarginResult = { ok: true } | { ok: false; message: string };

/**
 * Verify a rate sheet keeps the company's retained margin at or above the
 * configured minimum. The minimum is the product's minMarginPercent when the
 * config is product-specific (falling back to the carrier's), else the carrier's.
 * `companyFloorPercent` is the retained margin (whole percent, 0–100).
 */
export async function checkMinMargin(params: {
  carrierId: string;
  productId?: string | null;
  companyFloorPercent: number;
  override?: boolean;
}): Promise<MinMarginResult> {
  if (params.override) return { ok: true };

  let min = 0;
  let label = "this carrier";

  if (params.productId) {
    const product = await db.product.findUnique({
      where: { id: params.productId },
      include: { carrier: { select: { name: true, minMarginPercent: true } } },
    });
    if (product) {
      min = product.minMarginPercent ?? product.carrier.minMarginPercent;
      label = product.name;
    }
  } else {
    const carrier = await db.carrier.findUnique({
      where: { id: params.carrierId },
      select: { name: true, minMarginPercent: true },
    });
    min = carrier?.minMarginPercent ?? 0;
    label = carrier?.name ?? label;
  }

  if (params.companyFloorPercent < min) {
    return {
      ok: false,
      message: `Retained margin ${params.companyFloorPercent}% is below the ${min}% minimum for ${label}. Enable "override minimum margin" to save anyway.`,
    };
  }
  return { ok: true };
}

/**
 * Verify a master OWNER grant (available revenue $) leaves the company at or
 * above its minimum margin: companyFloor = carrierPayout − availableRevenue must
 * be ≥ minMarginPercent of carrierPayout. carrierPayout is the product's revenue
 * (if product-scoped) else the carrier's default.
 */
export async function checkGrantMargin(params: {
  carrierId: string;
  productId?: string | null;
  availableRevenue: number;
  override?: boolean;
}): Promise<MinMarginResult> {
  if (params.override) return { ok: true };

  let carrierPayout = 0;
  let min = 0;
  let label = "this carrier";

  if (params.productId) {
    const product = await db.product.findUnique({
      where: { id: params.productId },
      include: {
        carrier: { select: { name: true, revenuePerInstall: true, minMarginPercent: true } },
      },
    });
    if (product) {
      carrierPayout = product.revenue;
      min = product.minMarginPercent ?? product.carrier.minMarginPercent;
      label = product.name;
    }
  } else {
    const carrier = await db.carrier.findUnique({
      where: { id: params.carrierId },
      select: { name: true, revenuePerInstall: true, minMarginPercent: true },
    });
    if (carrier) {
      carrierPayout = carrier.revenuePerInstall;
      min = carrier.minMarginPercent;
      label = carrier.name;
    }
  }

  // Can't determine the revenue → don't block.
  if (carrierPayout <= 0) return { ok: true };

  const floorPct = ((carrierPayout - params.availableRevenue) / carrierPayout) * 100;
  if (floorPct < min) {
    return {
      ok: false,
      message: `Granting $${params.availableRevenue.toFixed(2)} leaves the company ${floorPct.toFixed(1)}% margin — below the ${min}% minimum for ${label}. Enable "override minimum margin" to save anyway.`,
    };
  }
  return { ok: true };
}

/**
 * Guard a FIELD_MANAGER setting a rep's flat pay: the rep pay must not exceed the
 * manager's own available-revenue grant (a manager can't pay a rep more than they
 * were allotted, which would drive the manager's margin negative). Compared
 * against the manager's own MANAGER-level rate sheet; if the manager has no
 * resolvable grant the cap is unknown → don't block. Blind to upstream: the
 * message references only the manager's own number.
 */
export async function checkRepPayMargin(params: {
  managerId: string;
  carrierId?: string | null;
  productId?: string | null;
  amount: number;
  at: Date;
  override?: boolean;
}): Promise<MinMarginResult> {
  if (params.override) return { ok: true };

  const available = await resolveRateSheet({
    level: "MANAGER",
    principalId: params.managerId,
    carrierId: params.carrierId || "",
    productId: params.productId,
    at: params.at,
  });

  // No grant → cap unknown → don't block.
  if (available === null) return { ok: true };

  if (params.amount > available) {
    return {
      ok: false,
      message: `Paying $${params.amount.toFixed(2)} exceeds your available revenue of $${available.toFixed(2)}. Enable "override" to save anyway.`,
    };
  }
  return { ok: true };
}

/**
 * Guard a MARKET_OWNER granting a manager available revenue: the manager grant
 * must not exceed the owner's own available-revenue grant. Compared against the
 * owner's own OWNER-level rate sheet; if the owner has no resolvable grant the
 * cap is unknown → don't block. Blind to upstream: the message references only
 * the owner's own number.
 */
export async function checkManagerGrantMargin(params: {
  ownerId: string;
  carrierId?: string | null;
  productId?: string | null;
  availableRevenue: number;
  at: Date;
  override?: boolean;
}): Promise<MinMarginResult> {
  if (params.override) return { ok: true };

  const ownerAvailable = await resolveRateSheet({
    level: "OWNER",
    principalId: params.ownerId,
    carrierId: params.carrierId || "",
    productId: params.productId,
    at: params.at,
  });

  // No grant → cap unknown → don't block.
  if (ownerAvailable === null) return { ok: true };

  if (params.availableRevenue > ownerAvailable) {
    return {
      ok: false,
      message: `Granting $${params.availableRevenue.toFixed(2)} exceeds your available revenue of $${ownerAvailable.toFixed(2)}. Enable "override" to save anyway.`,
    };
  }
  return { ok: true };
}
