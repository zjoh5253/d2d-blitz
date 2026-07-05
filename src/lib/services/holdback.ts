import { db } from "@/lib/db";
import { notifyRetentionBonusReleased } from "@/lib/services/notifications";

export type ResolvedHoldbackPolicy = {
  /** Whole percent, 0–100 (e.g. 10 = 10%). */
  percent: number;
  days: number;
};

export type HoldbackSplit = {
  immediate: number;
  held: number;
  percent: number;
  releaseAt: Date;
};

/** Round to whole cents to avoid float drift on money. */
function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve the holdback rule for a carrier at a point in time. Prefers a
 * carrier-specific policy, falls back to the global default (carrierId = null).
 * Returns null if no policy exists (→ no holdback, commission stays whole).
 */
export async function resolveHoldbackPolicy(
  carrierId: string,
  at: Date
): Promise<ResolvedHoldbackPolicy | null> {
  const policy = await db.holdbackPolicy.findFirst({
    where: {
      OR: [{ carrierId }, { carrierId: null }],
      effectiveDate: { lte: at },
    },
    orderBy: [
      { carrierId: "desc" }, // non-null (carrier-specific) sorts before null default
      { effectiveDate: "desc" },
    ],
  });

  if (!policy) return null;
  return { percent: policy.holdbackPercent, days: policy.holdbackDays };
}

/**
 * Split a gross rep commission into the immediately-payable portion and the
 * held portion, and compute when the held portion releases.
 */
export function splitHoldback(
  grossRepPay: number,
  policy: ResolvedHoldbackPolicy | null,
  base: Date
): HoldbackSplit {
  const percent = policy?.percent ?? 0;
  const held = percent > 0 ? roundMoney(grossRepPay * (percent / 100)) : 0;
  const immediate = roundMoney(grossRepPay - held);
  const releaseAt = new Date(base);
  releaseAt.setDate(releaseAt.getDate() + (policy?.days ?? 0));
  return { immediate, held, percent, releaseAt };
}

/**
 * Create/update the Holdback ledger row for a commission. Never clobbers a
 * holdback that has already been RELEASED or CLAWED_BACK.
 */
export async function upsertHoldback(params: {
  commissionRecordId: string;
  repId: string;
  carrierId: string;
  amount: number;
  percent: number;
  releaseAt: Date;
}): Promise<void> {
  const existing = await db.holdback.findUnique({
    where: { commissionRecordId: params.commissionRecordId },
  });

  if (!existing) {
    if (params.amount <= 0) return;
    await db.holdback.create({
      data: {
        commissionRecordId: params.commissionRecordId,
        repId: params.repId,
        carrierId: params.carrierId,
        amount: params.amount,
        percent: params.percent,
        releaseAt: params.releaseAt,
        status: "HELD",
      },
    });
    return;
  }

  // Only a still-held reserve may be recomputed.
  if (existing.status !== "HELD") return;
  await db.holdback.update({
    where: { commissionRecordId: params.commissionRecordId },
    data: {
      amount: params.amount,
      percent: params.percent,
      releaseAt: params.releaseAt,
    },
  });
}

/**
 * Release every holdback whose retention period has elapsed and whose sale is
 * still VERIFIED (charged-back sales are skipped). Released holdbacks become
 * payable in the next payout batch. Returns the released rows.
 */
export async function releaseDueHoldbacks(now: Date = new Date()) {
  const due = await db.holdback.findMany({
    where: {
      status: "HELD",
      releaseAt: { lte: now },
      commissionRecord: { sale: { status: "VERIFIED" } },
    },
  });

  const released: typeof due = [];
  for (const holdback of due) {
    await db.holdback.update({
      where: { id: holdback.id },
      data: { status: "RELEASED", releasedAt: now },
    });
    released.push(holdback);

    try {
      await notifyRetentionBonusReleased({
        repId: holdback.repId,
        amount: holdback.amount,
      });
    } catch (err) {
      console.error(
        `[holdback] Failed to notify rep ${holdback.repId} of released bonus:`,
        err
      );
    }
  }

  return released;
}
