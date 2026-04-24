/**
 * GET /api/admin/reconciliation/installs
 *
 * Returns install-to-commission reconciliation summary.
 *
 * A "reconcilable" install is one with status = MATCHED (linked to a Sale).
 * A "reconciled" install is one where that Sale also has a CommissionRecord.
 * An "unreconciled" install is where the Sale has no CommissionRecord.
 *
 * Optionally returns detail on unreconciled installs, including those that
 * have been matched for more than 24 hours without a commission (flagged).
 *
 * Query params:
 *   detail=true  — include per-install rows for unreconciled records
 *   limit        — max unreconciled rows to return (default 50)
 *
 * Auth: ADMIN, EXECUTIVE
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subHours } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const detail = searchParams.get("detail") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    // All MATCHED install records with their linked sale and commission
    const matchedInstalls = await db.installRecord.findMany({
      where: { status: "MATCHED" },
      include: {
        carrier: { select: { id: true, name: true } },
        matchedSale: {
          select: {
            id: true,
            customerName: true,
            submittedAt: true,
            rep: { select: { id: true, name: true } },
            commissionRecord: { select: { id: true, status: true, repPay: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const total = matchedInstalls.length;
    const reconciled = matchedInstalls.filter(
      (r) => r.matchedSale?.commissionRecord != null
    ).length;
    const unreconciled = total - reconciled;
    const reconciliationRate = total > 0 ? Math.round((reconciled / total) * 100) : 100;

    // Flagged = matched > 24h ago with no commission
    const cutoff = subHours(new Date(), 24);
    const unreconciledInstalls = matchedInstalls.filter(
      (r) => r.matchedSale?.commissionRecord == null
    );
    const flagged = unreconciledInstalls.filter(
      (r) => r.createdAt < cutoff
    ).length;

    const summary = {
      total,
      reconciled,
      unreconciled,
      flagged,
      reconciliationRate,
      targetRate: 95,
      targetMet: reconciliationRate >= 95,
    };

    if (!detail) {
      return NextResponse.json(summary);
    }

    // Return per-install detail for unreconciled records
    const rows = unreconciledInstalls.slice(0, limit).map((r) => ({
      installId: r.id,
      carrierId: r.carrierId,
      carrierName: r.carrier.name,
      customerName: r.customerName,
      customerAddress: r.customerAddress,
      installDate: r.installDate,
      matchedAt: r.createdAt,
      saleId: r.matchedSaleId,
      repName: r.matchedSale?.rep?.name ?? null,
      submittedAt: r.matchedSale?.submittedAt ?? null,
      isFlagged: r.createdAt < cutoff,
    }));

    return NextResponse.json({ ...summary, unreconciledInstalls: rows });
  } catch (error) {
    console.error("[GET /api/admin/reconciliation/installs]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
