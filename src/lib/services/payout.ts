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

export async function createPayoutBatch(period: string) {
  // Calculate reconciliation stats before entering the transaction
  const eligibleCommissions = await db.commissionRecord.findMany({
    where: { status: "ELIGIBLE" },
    include: { rep: true },
  });

  const blitzIds = [...new Set(eligibleCommissions.map((c) => c.blitzId))];
  const { totalInstalls, matchedInstalls, rate } = await calcReconciliation(blitzIds);

  const repPayouts = new Map<string, { grossPay: number; commissionIds: string[] }>();
  for (const commission of eligibleCommissions) {
    const existing = repPayouts.get(commission.repId) ?? { grossPay: 0, commissionIds: [] };
    existing.grossPay += commission.repPay;
    existing.commissionIds.push(commission.id);
    repPayouts.set(commission.repId, existing);
  }

  const slaDeadline = addBusinessDays(new Date(), 2);

  // Wrap all writes in a transaction so partial failures don't leave inconsistent state
  const batch = await db.$transaction(async (tx) => {
    const newBatch = await tx.payoutBatch.create({
      data: {
        period,
        totalInstalls,
        matchedInstalls,
        reconciliationRate: rate,
        slaDeadline,
      },
    });

    let totalPayout = 0;
    for (const [repId, payout] of repPayouts) {
      const deductions = await tx.deduction.findMany({ where: { repId } });
      const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

      const activeHolds = await tx.complianceHold.count({
        where: { repId, restoredDate: null },
      });

      const user = await tx.user.findUnique({
        where: { id: repId },
        include: { governanceTier: true },
      });

      const netPay = Math.max(0, payout.grossPay - totalDeductions);
      totalPayout += netPay;

      await tx.payoutLine.create({
        data: {
          batchId: newBatch.id,
          repId,
          grossPay: payout.grossPay,
          totalDeductions,
          netPay,
          complianceVerified: activeHolds === 0,
          governanceChecked: !!user?.governanceTier,
        },
      });

      await tx.commissionRecord.updateMany({
        where: { id: { in: payout.commissionIds } },
        data: { status: "PENDING" },
      });
    }

    await tx.payoutBatchAuditLog.create({
      data: {
        batchId: newBatch.id,
        action: "CREATED",
        totalPayout,
        notes: `Nightly batch for period "${period}". ${repPayouts.size} reps, ${totalInstalls} installs, ${matchedInstalls} matched (${(rate * 100).toFixed(1)}% reconciliation). SLA deadline: ${slaDeadline.toISOString()}.`,
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
