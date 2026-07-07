import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

// Rep-facing pay tracking. Surfaces the rep's own commissions and payout
// history — downstream of install reconciliation (a sale flips to VERIFIED,
// a CommissionRecord is created, it rolls into a PayoutBatch, then PAID).
//
// Auth mirrors /api/rep/scorecard: reps see only their own pay; managers
// (ADMIN / FIELD_MANAGER) may pull any rep via ?repId=.
//
// Commission lifecycle reflected here:
//   ELIGIBLE  → created, not yet batched      ┐ shown as "pending"
//   PENDING   → bundled into a payout batch    ┘
//   ON_HOLD   → blocked (compliance/governance)
//   PAID      → paid out

interface RecentCommission {
  id: string;
  customerName: string;
  carrierName: string;
  blitzName: string;
  repPay: number;
  status: string;
  createdAt: string;
}

interface PayoutHistoryLine {
  id: string;
  period: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  complianceVerified: boolean;
  approvedAt: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repIdParam = searchParams.get("repId");
    const isManager = session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER";
    const repId = isManager && repIdParam ? repIdParam : session.user.id!;

    const [paid, pendingAgg, onHold, lifetime, recentRows, payoutRows, user] =
      await Promise.all([
        db.commissionRecord.aggregate({ where: { repId, status: "PAID" }, _sum: { repPay: true } }),
        db.commissionRecord.aggregate({
          where: { repId, status: { in: ["ELIGIBLE", "PENDING"] } },
          _sum: { repPay: true },
        }),
        db.commissionRecord.aggregate({ where: { repId, status: "ON_HOLD" }, _sum: { repPay: true } }),
        db.commissionRecord.aggregate({ where: { repId }, _sum: { repPay: true } }),
        db.commissionRecord.findMany({
          where: { repId },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            repPay: true,
            status: true,
            createdAt: true,
            sale: { select: { customerName: true, carrier: { select: { name: true } } } },
            blitz: { select: { name: true } },
          },
        }),
        db.payoutLine.findMany({
          where: { repId },
          orderBy: { batch: { createdAt: "desc" } },
          take: 12,
          select: {
            id: true,
            grossPay: true,
            totalDeductions: true,
            netPay: true,
            complianceVerified: true,
            batch: { select: { period: true, status: true, approvedAt: true } },
          },
        }),
        db.user.findUnique({
          where: { id: repId },
          select: {
            governanceTier: { select: { name: true, commissionMultiplier: true } },
            complianceHolds: { where: { restoredDate: null }, select: { reason: true } },
          },
        }),
      ]);

    const recent: RecentCommission[] = recentRows.map((r) => ({
      id: r.id,
      customerName: r.sale.customerName,
      carrierName: r.sale.carrier.name,
      blitzName: r.blitz.name,
      repPay: r.repPay,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));

    const payouts: PayoutHistoryLine[] = payoutRows.map((p) => ({
      id: p.id,
      period: p.batch.period,
      grossPay: p.grossPay,
      totalDeductions: p.totalDeductions,
      netPay: p.netPay,
      status: p.batch.status,
      complianceVerified: p.complianceVerified,
      approvedAt: p.batch.approvedAt ? p.batch.approvedAt.toISOString() : null,
    }));

    return NextResponse.json({
      repId,
      tier: user?.governanceTier
        ? { name: user.governanceTier.name, multiplier: user.governanceTier.commissionMultiplier }
        : null,
      holds: {
        active: user?.complianceHolds.length ?? 0,
        reasons: user?.complianceHolds.map((h) => h.reason) ?? [],
      },
      summary: {
        paidToDate: paid._sum.repPay ?? 0,
        pending: pendingAgg._sum.repPay ?? 0,
        onHold: onHold._sum.repPay ?? 0,
        lifetimeGross: lifetime._sum.repPay ?? 0,
      },
      recent,
      payouts,
    });
  } catch (error) {
    console.error("[GET /api/rep/pay]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
