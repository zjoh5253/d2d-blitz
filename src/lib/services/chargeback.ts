import { db } from "@/lib/db";
import { notifyChargeback } from "@/lib/services/notifications";

export type RecordChargebackInput = {
  saleId: string;
  amount: number;
  reason: string;
  actorId?: string;
};

/**
 * Record a carrier chargeback against a sale. Held funds (an un-released
 * holdback for the sale's commission) are applied first; any shortfall is stored
 * as outstandingBalance for manual handling — no automatic deduction is created.
 * The sale is moved to CHARGEBACK so its holdback can no longer be released.
 */
export async function recordChargeback(input: RecordChargebackInput) {
  const { saleId, amount, reason, actorId } = input;

  if (amount <= 0) throw new Error("Chargeback amount must be greater than zero");

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { commissionRecord: { include: { holdback: true } } },
  });

  if (!sale) throw new Error("Sale not found");

  const existing = await db.chargeback.findUnique({ where: { saleId } });
  if (existing) throw new Error("A chargeback already exists for this sale");

  const holdback = sale.commissionRecord?.holdback ?? null;
  const heldAvailable =
    holdback && holdback.status === "HELD" ? holdback.amount : 0;
  const heldApplied = Math.min(heldAvailable, amount);
  const outstandingBalance = Math.round((amount - heldApplied) * 100) / 100;

  const chargeback = await db.$transaction(async (tx) => {
    const created = await tx.chargeback.create({
      data: {
        saleId,
        commissionRecordId: sale.commissionRecord?.id ?? null,
        repId: sale.repId,
        carrierId: sale.carrierId,
        amount,
        heldApplied,
        outstandingBalance,
        status: outstandingBalance <= 0 ? "RECOVERED" : "OPEN",
        reason,
        createdById: actorId,
      },
    });

    if (holdback && holdback.status === "HELD") {
      await tx.holdback.update({
        where: { id: holdback.id },
        data: { status: "CLAWED_BACK", chargebackId: created.id },
      });
    }

    await tx.sale.update({
      where: { id: saleId },
      data: { status: "CHARGEBACK" },
    });

    return created;
  });

  try {
    await notifyChargeback({
      repId: sale.repId,
      customerName: sale.customerName,
      amount,
    });
  } catch (err) {
    console.error(`[chargeback] Failed to notify rep ${sale.repId}:`, err);
  }

  return chargeback;
}
