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
