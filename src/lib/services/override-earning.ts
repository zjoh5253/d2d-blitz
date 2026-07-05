import { db } from "@/lib/db";

type OverrideRole = "MANAGER_OVERRIDE" | "MARKET_OWNER_SPREAD";

async function upsertOne(
  commissionRecordId: string,
  role: OverrideRole,
  payeeId: string | null,
  amount: number
): Promise<void> {
  if (!payeeId || amount <= 0) return;

  const existing = await db.overrideEarning.findUnique({
    where: { commissionRecordId_role: { commissionRecordId, role } },
  });

  if (!existing) {
    await db.overrideEarning.create({
      data: { commissionRecordId, payeeId, role, amount, status: "ELIGIBLE" },
    });
    return;
  }

  // Only a still-eligible earning may be recomputed; never clobber PENDING/PAID.
  if (existing.status !== "ELIGIBLE") return;
  await db.overrideEarning.update({
    where: { commissionRecordId_role: { commissionRecordId, role } },
    data: { payeeId, amount },
  });
}

/**
 * Create/update the override earnings for a commission: the manager override goes
 * to the blitz's manager, the market-owner spread goes to the market's owner.
 * Idempotent per (commission, role); never clobbers an already-batched earning.
 */
export async function upsertOverrideEarnings(params: {
  commissionRecordId: string;
  managerId: string | null;
  ownerId: string | null;
  managerOverride: number;
  marketOwnerSpread: number;
}): Promise<void> {
  await upsertOne(
    params.commissionRecordId,
    "MANAGER_OVERRIDE",
    params.managerId,
    params.managerOverride
  );
  await upsertOne(
    params.commissionRecordId,
    "MARKET_OWNER_SPREAD",
    params.ownerId,
    params.marketOwnerSpread
  );
}
