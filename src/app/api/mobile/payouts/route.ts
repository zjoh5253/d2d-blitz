/**
 * GET /api/mobile/payouts
 *
 * Returns a list of payout batches that include the authenticated rep,
 * ordered newest first. Use /api/mobile/payouts/:id/breakdown for
 * the full line-item detail of a specific batch.
 *
 * Auth: mobile Bearer token (same JWT used by all /api/mobile/* routes).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repId = session.user.id;

  try {
    const lines = await db.payoutLine.findMany({
      where: { repId },
      include: {
        batch: {
          select: { id: true, period: true, status: true, createdAt: true },
        },
      },
      orderBy: { batch: { createdAt: "desc" } },
    });

    const items = lines.map((line) => ({
      batchId: line.batch.id,
      period: line.batch.period,
      batchStatus: line.batch.status,
      grossPay: line.grossPay,
      totalDeductions: line.totalDeductions,
      netPay: line.netPay,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("[GET /api/mobile/payouts]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
