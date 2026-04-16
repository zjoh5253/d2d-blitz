import { db } from "@/lib/db";
import { notifyPayoutApproved } from "@/lib/services/notifications";

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

  // Use sales as the denominator: each sale should have a matched install record
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

/** Write a single audit log entry for a payout batch. */
async function writeAuditLog(params: {
  batchId: string;
  action: string;
  performedById?: string;
  totalPayout?: number;
  notes?: string;
}) {
  await db.payoutBatchAuditLog.create({
    data: {
      batchId: params.batchId,
      action: params.action,
      performedById: params.performedById ?? null,
      totalPayout: params.totalPayout ?? null,
      notes: params.notes ?? null,
    },
  });
}

export async function createPayoutBatch(period: string) {
  const eligibleCommissions = await db.commissionRecord.findMany({
    where: { status: "ELIGIBLE" },
    include: { rep: true },
  });

  const blitzIds = [...new Set(eligibleCommissions.map((c) => c.blitzId))];
  const { totalInstalls, matchedInstalls, rate } = await calcReconciliation(blitzIds);

  // Group by rep
  const repPayouts = new Map<string, { grossPay: number; commissionIds: string[] }>();
  for (const commission of eligibleCommissions) {
    const existing = repPayouts.get(commission.repId) ?? { grossPay: 0, commissionIds: [] };
    existing.grossPay += commission.repPay;
    existing.commissionIds.push(commission.id);
    repPayouts.set(commission.repId, existing);
  }

  const slaDeadline = addBusinessDays(new Date(), 2);

  const batch = await db.payoutBatch.create({
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
    const deductions = await db.deduction.findMany({ where: { repId } });
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    const activeHolds = await db.complianceHold.count({
      where: { repId, restoredDate: null },
    });

    const user = await db.user.findUnique({
      where: { id: repId },
      include: { governanceTier: true },
    });

    const netPay = Math.max(0, payout.grossPay - totalDeductions);
    totalPayout += netPay;

    await db.payoutLine.create({
      data: {
        batchId: batch.id,
        repId,
        grossPay: payout.grossPay,
        totalDeductions,
        netPay,
        complianceVerified: activeHolds === 0,
        governanceChecked: !!user?.governanceTier,
      },
    });

    await db.commissionRecord.updateMany({
      where: { id: { in: payout.commissionIds } },
      data: { status: "PENDING" },
    });
  }

  await writeAuditLog({
    batchId: batch.id,
    action: "CREATED",
    totalPayout,
    notes: `Nightly batch for period "${period}". ${repPayouts.size} reps, ${totalInstalls} installs, ${matchedInstalls} matched (${(rate * 100).toFixed(1)}% reconciliation). SLA deadline: ${slaDeadline.toISOString()}.`,
  });

  return batch;
}

export async function reviewPayoutBatch(batchId: string, reviewedById: string) {
  const batch = await db.payoutBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Batch not found");

  const updated = await db.payoutBatch.update({
    where: { id: batchId },
    data: { status: "REVIEWED" },
  });

  await writeAuditLog({
    batchId,
    action: "REVIEWED",
    performedById: reviewedById,
    notes: `Batch marked REVIEWED.`,
  });

  return updated;
}

export async function approvePayoutBatch(batchId: string, approvedById: string) {
  const batch = await db.payoutBatch.findUnique({
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

  const updated = await db.payoutBatch.update({
    where: { id: batchId },
    data: { status: "APPROVED", approvedById, approvedAt: new Date() },
  });

  await writeAuditLog({
    batchId,
    action: "APPROVED",
    performedById: approvedById,
    totalPayout,
    notes: `Batch approved. Total net payout: $${totalPayout.toFixed(2)}.`,
  });

  return updated;
}

export async function markPayoutBatchPaid(batchId: string) {
  const batch = await db.payoutBatch.findUnique({
    where: { id: batchId },
    include: { payoutLines: true },
  });

  if (!batch || batch.status !== "APPROVED") {
    throw new Error("Batch must be approved before marking as paid");
  }

  const totalPayout = batch.payoutLines.reduce((s, l) => s + l.netPay, 0);

  for (const line of batch.payoutLines) {
    await db.commissionRecord.updateMany({
      where: { repId: line.repId, status: "PENDING" },
      data: { status: "PAID" },
    });
  }

  const updated = await db.payoutBatch.update({
    where: { id: batchId },
    data: { status: "PAID" },
  });

  await writeAuditLog({
    batchId,
    action: "PAID",
    totalPayout,
    notes: `Batch marked PAID. ${batch.payoutLines.length} reps receiving payouts.`,
  });

  // Notify all reps
  for (const line of batch.payoutLines) {
    try {
      await notifyPayoutApproved({
        repId: line.repId,
        batchId,
        period: batch.period,
        netPay: line.netPay,
      });
    } catch (err) {
      console.error(`[payout] Failed to notify rep ${line.repId}:`, err);
    }
  }

  return updated;
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

    await db.payoutBatch.update({
      where: { id: batch.id },
      data: { slaAlertedAt: now },
    });

    await writeAuditLog({
      batchId: batch.id,
      action: "SLA_ALERT",
      totalPayout,
      notes: `SLA breach: batch for period "${batch.period}" not approved within 2 business days. Deadline was ${batch.slaDeadline?.toISOString()}.`,
    });

    alerted.push(batch.id);
  }

  return alerted;
}
