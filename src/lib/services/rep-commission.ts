import { db } from "@/lib/db";

/**
 * Resolve the custom flat commission for a rep on a specific sale, if any.
 * Most-specific match wins: rep+product → rep+carrier → rep-global. Only active
 * overrides effective on/before the given date are considered. Returns the
 * winning override's id + flat amount, or null when the rep is on the default plan.
 */
export async function resolveRepOverride(params: {
  repId: string;
  carrierId: string;
  productId?: string | null;
  at: Date;
}): Promise<{ id: string; amount: number } | null> {
  const override = await db.repCommissionOverride.findFirst({
    where: {
      repId: params.repId,
      active: true,
      effectiveDate: { lte: params.at },
      // A product override only matches this sale's product; a carrier override
      // only this sale's carrier; a global override (both null) always matches.
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
    select: { id: true, amount: true },
  });

  return override ?? null;
}
