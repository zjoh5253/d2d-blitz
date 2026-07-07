import { db } from "@/lib/db";

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
