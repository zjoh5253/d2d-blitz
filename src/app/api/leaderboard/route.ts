import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date();

  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const start = new Date(now);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "season") {
    // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // lifetime
  const start = new Date(0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "month";
    const marketId = searchParams.get("marketId") ?? undefined;
    const blitzId = searchParams.get("blitzId") ?? undefined;

    const { start, end } = getPeriodDates(period);

    // Get reps with active compliance holds
    const heldReps = await db.complianceHold.findMany({
      where: { restoredDate: null },
      select: { repId: true },
    });
    const heldRepIds = new Set(heldReps.map((h) => h.repId));

    // Get reps with governance suspension (consecutiveStrikes >= 2 in latest period)
    const latestPeriods = await db.governancePeriod.findMany({
      where: { consecutiveStrikes: { gte: 2 } },
      select: { repId: true },
      distinct: ["repId"],
    });
    const suspendedRepIds = new Set(latestPeriods.map((p) => p.repId));

    // Build sale filter
    const saleWhere: Record<string, unknown> = {
      status: "VERIFIED",
      submittedAt: { gte: start, lte: end },
    };

    if (blitzId) {
      saleWhere.blitzId = blitzId;
    } else if (marketId) {
      saleWhere.blitz = { marketId };
    }

    // Aggregate verified installs per rep
    const salesByRep = await db.sale.groupBy({
      by: ["repId"],
      where: saleWhere,
      _count: { id: true },
    });

    // Total sales per rep (for install rate)
    const totalSalesByRep = await db.sale.groupBy({
      by: ["repId"],
      where: {
        submittedAt: { gte: start, lte: end },
        ...(blitzId ? { blitzId } : marketId ? { blitz: { marketId } } : {}),
      },
      _count: { id: true },
    });

    const totalSalesMap = new Map(
      totalSalesByRep.map((r) => [r.repId, r._count.id])
    );

    // Get rep details
    const repIds = salesByRep.map((r) => r.repId);
    const reps = await db.user.findMany({
      where: { id: { in: repIds } },
      select: {
        id: true,
        name: true,
        email: true,
        governanceTier: { select: { id: true, name: true } },
      },
    });
    const repMap = new Map(reps.map((r) => [r.id, r]));

    // Build leaderboard, filtering out held/suspended reps
    const rows = salesByRep
      .filter((r) => !heldRepIds.has(r.repId) && !suspendedRepIds.has(r.repId))
      .map((r) => {
        const rep = repMap.get(r.repId);
        const verifiedInstalls = r._count.id;
        const totalSales = totalSalesMap.get(r.repId) ?? 0;
        const installRate = totalSales > 0 ? verifiedInstalls / totalSales : 0;
        return {
          repId: r.repId,
          repName: rep?.name ?? "Unknown",
          verifiedInstalls,
          sales: totalSales,
          installRate,
          tier: rep?.governanceTier?.name ?? null,
        };
      })
      .sort((a, b) => b.verifiedInstalls - a.verifiedInstalls)
      .map((row, idx) => ({ ...row, rank: idx + 1 }));

    return NextResponse.json({ period, rows });
  } catch (error) {
    console.error("[GET /api/leaderboard]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
