import { db } from "@/lib/db";
import { notifyPayoutPaid } from "@/lib/services/notifications";

/** Add N business days (Mon–Fri) to a date. */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/** Calculate install-to-commission reconciliation rate for a set of blitzes. */
async function calcReconciliation(blitzIds: string[]) {
  if (blitzIds.length === 0) return { totalInstalls: 0, matchedInstalls: 0, rate: 0 };

  const totalSales = await db.sale.count({ where: { blitzId: { in: blitzIds } } });
  const matchedSales = await db.sale.count({
    where: {
      blitzId: { in: blitzIds },
      matchedInstallRecord: { isNot: null },
    },
  });

  const rate = totalSales > 0 ? matchedSales / totalSales : 0;
  return { totalInstalls: totalSales, matchedInstalls: matchedSales, rate };
}

export type CreatePayoutBatchOptions = {
  /** Manager/owner who initiated this run; null/undefined = admin/company global batch. */
  initiatedById?: string | null;
  /** Restrict rep commissions to these rep ids (manager-initiated scope). */
  scopeRepIds?: string[];
};

type PayeePayout = {
  grossPay: number;
  commissionIds: string[];
  holdbackIds: string[];
  overrideEarningIds: string[];
};

export async function createPayoutBatch(
  period: string,
  opts: CreatePayoutBatchOptions = {}
) {
  const { initiatedById = null, scopeRepIds } = opts;
  const scoped = Array.isArray(scopeRepIds);

  // Rep commissions — scoped to the manager's downline when manager-initiated.
  const eligibleCommissions = await db.commissionRecord.findMany({
    where: {
      status: "ELIGIBLE",
      ...(scoped ? { repId: { in: scopeRepIds } } : {}),
    },
    include: { rep: true },
  });

  const blitzIds = [...new Set(eligibleCommissions.map((c) => c.blitzId))];
  const { totalInstalls, matchedInstalls, rate } = await calcReconciliation(blitzIds);

  // Payees are keyed by userId — reps get their commissions, managers/owners get
  // their override earnings. A manager is just another User, so payBatchViaStripe
  // transfers to their connected account with no special casing.
  const payouts = new Map<string, PayeePayout>();
  const get = (id: string): PayeePayout =>
    payouts.get(id) ?? { grossPay: 0, commissionIds: [], holdbackIds: [], overrideEarningIds: [] };

  for (const commission of eligibleCommissions) {
    const p = get(commission.repId);
    p.grossPay += commission.repPay;
    p.commissionIds.push(commission.id);
    payouts.set(commission.repId, p);
  }

  // Fold in released-but-unpaid retention bonuses (holdbacks). In a scoped run,
  // only the manager's downline reps' holdbacks are included.
  const releasedHoldbacks = await db.holdback.findMany({
    where: {
      status: "RELEASED",
      payoutBatchId: null,
      ...(scoped ? { repId: { in: scopeRepIds } } : {}),
    },
  });
  for (const holdback of releasedHoldbacks) {
    const p = get(holdback.repId);
    p.grossPay += holdback.amount;
    p.holdbackIds.push(holdback.id);
    payouts.set(holdback.repId, p);
  }

  // Fold in override earnings. Global batch pays every eligible override; a
  // manager-initiated run pays only the initiating manager's own overrides.
  const overrideEarnings = await db.overrideEarning.findMany({
    where: {
      status: "ELIGIBLE",
      payoutBatchId: null,
      ...(scoped && initiatedById ? { payeeId: initiatedById } : {}),
    },
  });
  for (const earning of overrideEarnings) {
    const p = get(earning.payeeId);
    p.grossPay += earning.amount;
    p.overrideEarningIds.push(earning.id);
    payouts.set(earning.payeeId, p);
  }

  if (payouts.size === 0) {
    throw new Error("No eligible payouts for this run");
  }

  const slaDeadline = addBusinessDays(new Date(), 2);

  // Wrap all writes in a transaction so partial failures don't leave inconsistent state
  const batch = await db.$transaction(async (tx) => {
    const newBatch = await tx.payoutBatch.create({
      data: {
        period,
        initiatedById,
        totalInstalls,
        matchedInstalls,
        reconciliationRate: rate,
        slaDeadline,
      },
    });

    let totalPayout = 0;
    for (const [payeeId, payout] of payouts) {
      const deductions = await tx.deduction.findMany({ where: { repId: payeeId } });
      const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

      const activeHolds = await tx.complianceHold.count({
        where: { repId: payeeId, restoredDate: null },
      });

      const user = await tx.user.findUnique({
        where: { id: payeeId },
        include: { governanceTier: true },
      });

      const netPay = Math.max(0, payout.grossPay - totalDeductions);
      totalPayout += netPay;

      await tx.payoutLine.create({
        data: {
          batchId: newBatch.id,
          repId: payeeId,
          grossPay: payout.grossPay,
          totalDeductions,
          netPay,
          complianceVerified: activeHolds === 0,
          governanceChecked: !!user?.governanceTier,
        },
      });

      if (payout.commissionIds.length > 0) {
        await tx.commissionRecord.updateMany({
          where: { id: { in: payout.commissionIds } },
          data: { status: "PENDING" },
        });
      }

      if (payout.holdbackIds.length > 0) {
        await tx.holdback.updateMany({
          where: { id: { in: payout.holdbackIds } },
          data: { payoutBatchId: newBatch.id },
        });
      }

      if (payout.overrideEarningIds.length > 0) {
        await tx.overrideEarning.updateMany({
          where: { id: { in: payout.overrideEarningIds } },
          data: { status: "PENDING", payoutBatchId: newBatch.id },
        });
      }
    }

    const scopeNote = initiatedById
      ? `Manager-initiated run (initiator ${initiatedById}).`
      : "Company batch.";
    await tx.payoutBatchAuditLog.create({
      data: {
        batchId: newBatch.id,
        action: "CREATED",
        totalPayout,
        notes: `${scopeNote} Period "${period}". ${payouts.size} payees, ${totalInstalls} installs, ${matchedInstalls} matched (${(rate * 100).toFixed(1)}% reconciliation). SLA deadline: ${slaDeadline.toISOString()}.`,
      },
    });

    return newBatch;
  });

  return batch;
}

export async function reviewPayoutBatch(batchId: string, reviewedById: string) {
  return db.$transaction(async (tx) => {
    const batch = await tx.payoutBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error("Batch not found");

    const updated = await tx.payoutBatch.update({
      where: { id: batchId },
      data: { status: "REVIEWED" },
    });

    await tx.payoutBatchAuditLog.create({
      data: {
        batchId,
        action: "REVIEWED",
        performedById: reviewedById,
        notes: `Batch marked REVIEWED.`,
      },
    });

    return updated;
  });
}

export async function approvePayoutBatch(batchId: string, approvedById: string) {
  return db.$transaction(async (tx) => {
    const batch = await tx.payoutBatch.findUnique({
      where: { id: batchId },
      include: { payoutLines: true },
    });
    if (!batch) throw new Error("Batch not found");

    if (batch.reconciliationRate < 0.95) {
      throw new Error(
        `Reconciliation rate is ${(batch.reconciliationRate * 100).toFixed(1)}% — must reach 95% before this batch can be approved. Resolve unmatched installs first.`
      );
    }

    const totalPayout = batch.payoutLines.reduce((s, l) => s + l.netPay, 0);

    const updated = await tx.payoutBatch.update({
      where: { id: batchId },
      data: { status: "APPROVED", approvedById, approvedAt: new Date() },
    });

    await tx.payoutBatchAuditLog.create({
      data: {
        batchId,
        action: "APPROVED",
        performedById: approvedById,
        totalPayout,
        notes: `Batch approved. Total net payout: $${totalPayout.toFixed(2)}.`,
      },
    });

    return updated;
  });
}

export async function markPayoutBatchPaid(batchId: string) {
  const batch = await db.$transaction(async (tx) => {
    const b = await tx.payoutBatch.findUnique({
      where: { id: batchId },
      include: { payoutLines: true },
    });

    if (!b || b.status !== "APPROVED") {
      throw new Error("Batch must be approved before marking as paid");
    }

    const totalPayout = b.payoutLines.reduce((s, l) => s + l.netPay, 0);

    for (const line of b.payoutLines) {
      await tx.commissionRecord.updateMany({
        where: { repId: line.repId, status: "PENDING" },
        data: { status: "PAID" },
      });
    }

    await tx.payoutBatch.update({
      where: { id: batchId },
      data: { status: "PAID" },
    });

    await tx.payoutBatchAuditLog.create({
      data: {
        batchId,
        action: "PAID",
        totalPayout,
        notes: `Batch marked PAID. ${b.payoutLines.length} reps receiving payouts.`,
      },
    });

    return b;
  });

  // Send notifications outside the transaction (non-critical, should not roll back financial data)
  for (const line of batch.payoutLines) {
    try {
      await notifyPayoutPaid({
        repId: line.repId,
        batchId,
        period: batch.period,
        netPay: line.netPay,
      });
    } catch (err) {
      console.error(`[payout] Failed to notify rep ${line.repId}:`, err);
    }
  }

  return batch;
}

/**
 * Check DRAFT/REVIEWED batches for SLA breach (past 2 business days).
 * Returns batchIds newly alerted.
 */
export async function checkPayoutBatchSLA(): Promise<string[]> {
  const now = new Date();

  const overdue = await db.payoutBatch.findMany({
    where: {
      status: { in: ["DRAFT", "REVIEWED"] },
      slaDeadline: { lt: now },
      slaAlertedAt: null,
    },
    include: { payoutLines: true },
  });

  const alerted: string[] = [];
  for (const batch of overdue) {
    const totalPayout = batch.payoutLines.reduce((s, l) => s + l.netPay, 0);

    await db.$transaction(async (tx) => {
      await tx.payoutBatch.update({
        where: { id: batch.id },
        data: { slaAlertedAt: now },
      });

      await tx.payoutBatchAuditLog.create({
        data: {
          batchId: batch.id,
          action: "SLA_ALERT",
          totalPayout,
          notes: `SLA breach: batch for period "${batch.period}" not approved within 2 business days. Deadline was ${batch.slaDeadline?.toISOString()}.`,
        },
      });
    });

    alerted.push(batch.id);
  }

  return alerted;
}
