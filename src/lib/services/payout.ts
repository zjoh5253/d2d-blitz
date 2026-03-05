import { db } from "@/lib/db";

export async function createPayoutBatch(period: string) {
  // Get all eligible commission records that haven't been paid
  const eligibleCommissions = await db.commissionRecord.findMany({
    where: { status: "ELIGIBLE" },
    include: { rep: true },
  });

  // Group by rep
  const repPayouts = new Map<
    string,
    { grossPay: number; commissionIds: string[] }
  >();

  for (const commission of eligibleCommissions) {
    const existing = repPayouts.get(commission.repId) ?? {
      grossPay: 0,
      commissionIds: [],
    };
    existing.grossPay += commission.repPay;
    existing.commissionIds.push(commission.id);
    repPayouts.set(commission.repId, existing);
  }

  // Create batch
  const batch = await db.payoutBatch.create({
    data: { period },
  });

  // Create payout lines
  for (const [repId, payout] of repPayouts) {
    // Get deductions for this rep
    const deductions = await db.deduction.findMany({
      where: { repId },
    });
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    // Check compliance
    const activeHolds = await db.complianceHold.count({
      where: { repId, restoredDate: null },
    });

    // Check governance
    const user = await db.user.findUnique({
      where: { id: repId },
      include: { governanceTier: true },
    });

    await db.payoutLine.create({
      data: {
        batchId: batch.id,
        repId,
        grossPay: payout.grossPay,
        totalDeductions,
        netPay: payout.grossPay - totalDeductions,
        complianceVerified: activeHolds === 0,
        governanceChecked: !!user?.governanceTier,
      },
    });

    // Mark commissions as pending
    await db.commissionRecord.updateMany({
      where: { id: { in: payout.commissionIds } },
      data: { status: "PENDING" },
    });
  }

  return batch;
}

export async function approvePayoutBatch(
  batchId: string,
  approvedById: string
) {
  return db.payoutBatch.update({
    where: { id: batchId },
    data: {
      status: "APPROVED",
      approvedById,
      approvedAt: new Date(),
    },
  });
}

export async function markPayoutBatchPaid(batchId: string) {
  const batch = await db.payoutBatch.findUnique({
    where: { id: batchId },
    include: { payoutLines: true },
  });

  if (!batch || batch.status !== "APPROVED") {
    throw new Error("Batch must be approved before marking as paid");
  }

  // Mark all related commissions as paid
  for (const line of batch.payoutLines) {
    await db.commissionRecord.updateMany({
      where: { repId: line.repId, status: "PENDING" },
      data: { status: "PAID" },
    });
  }

  return db.payoutBatch.update({
    where: { id: batchId },
    data: { status: "PAID" },
  });
}
