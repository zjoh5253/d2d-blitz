/**
 * GET /api/mobile/payouts/:id/breakdown
 *
 * Returns a line-item breakdown of a payout batch for the authenticated rep:
 *   - commission records (gross earnings per sale)
 *   - deductions (with human-readable reasons)
 *   - net pay summary
 *
 * Auth: mobile Bearer token (same JWT used by all /api/mobile/* routes).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

const DEDUCTION_CATEGORY_LABELS: Record<string, string> = {
  HOUSING: "Housing cost",
  TRAVEL: "Travel expense",
  SHARED: "Shared team expense",
  REP_SPECIFIC: "Rep-specific deduction",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repId = session.user.id;
  const { id: batchId } = await params;

  try {
    // Load the batch and this rep's payout line in one query
    const batch = await db.payoutBatch.findUnique({
      where: { id: batchId },
      include: {
        payoutLines: {
          where: { repId },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    const line = batch.payoutLines[0];
    if (!line) {
      return NextResponse.json(
        { error: "You are not included in this payout" },
        { status: 404 }
      );
    }

    // Determine which commission status to look for based on batch status
    const commissionStatuses =
      batch.status === "PAID" ? ["PAID"] : ["PENDING"];

    // Fetch commission records for this rep in this batch.
    // Since commissions are atomically moved ELIGIBLE→PENDING on batch creation
    // and PENDING→PAID on batch payment, filtering by current status is safe.
    const commissions = await db.commissionRecord.findMany({
      where: {
        repId,
        status: { in: commissionStatuses },
      },
      include: {
        sale: {
          select: {
            id: true,
            customerName: true,
            installDate: true,
          },
        },
        blitz: {
          select: { id: true, name: true },
        },
        governanceTier: {
          select: { id: true, name: true, commissionMultiplier: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Fetch all deductions for this rep (matches how they were summed at batch creation)
    const deductions = await db.deduction.findMany({
      where: { repId },
      include: {
        blitz: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    const commissionItems = commissions.map((c) => ({
      id: c.id,
      saleId: c.saleId,
      customerName: c.sale.customerName,
      installDate: c.sale.installDate,
      blitzId: c.blitzId,
      blitzName: c.blitz.name,
      amount: c.repPay,
      governanceTier: c.governanceTier
        ? {
            name: c.governanceTier.name,
            multiplier: c.governanceTier.commissionMultiplier,
          }
        : null,
    }));

    const deductionItems = deductions.map((d) => ({
      id: d.id,
      category: d.category,
      reason: DEDUCTION_CATEGORY_LABELS[d.category] ?? d.category,
      description: d.description,
      amount: d.amount,
      blitzId: d.blitzId,
      blitzName: d.blitz.name,
      date: d.date,
    }));

    return NextResponse.json({
      batchId: batch.id,
      period: batch.period,
      batchStatus: batch.status,
      grossPay: line.grossPay,
      commissions: commissionItems,
      deductions: deductionItems,
      totalDeductions: line.totalDeductions,
      netPay: line.netPay,
      complianceVerified: line.complianceVerified,
      governanceChecked: line.governanceChecked,
    });
  } catch (error) {
    console.error("[GET /api/mobile/payouts/[id]/breakdown]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
