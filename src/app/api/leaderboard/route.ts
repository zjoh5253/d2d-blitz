import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Resolve a named preset to a [start, end] window. A custom range (from/to)
// is handled by the caller and takes precedence over the preset.
function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date();

  if (period === "today") return { start: startOfDay(now), end: endOfDay(now) };

  if (period === "yesterday") {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }

  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const start = new Date(now);
    start.setDate(diff);
    return { start: startOfDay(start), end: endOfDay(now) };
  }

  if (period === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
  }

  // "all" / lifetime (default)
  return { start: new Date(0), end: endOfDay(now) };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "month";
    const marketId = searchParams.get("marketId") ?? undefined;
    const blitzId = searchParams.get("blitzId") ?? undefined;
    const repId = searchParams.get("repId") ?? undefined;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Custom range wins over the named preset when both ends are valid dates.
    let start: Date, end: Date;
    const from = fromParam ? new Date(fromParam) : null;
    const to = toParam ? new Date(toParam) : null;
    if (from && to && !isNaN(from.getTime()) && !isNaN(to.getTime())) {
      start = startOfDay(from);
      end = endOfDay(to);
    } else {
      ({ start, end } = getPeriodDates(period));
    }

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

    // Scope filters — combinable. blitz wins over market for the geographic
    // scope; repId narrows to a single rep on top of either.
    const scopeWhere: Record<string, unknown> = {
      ...(blitzId ? { blitzId } : marketId ? { blitz: { marketId } } : {}),
      ...(repId ? { repId } : {}),
    };

    // Total sales per rep (any status) — drives leaderboard membership
    // so reps with submitted-but-not-yet-verified sales still appear.
    const totalSalesByRep = await db.sale.groupBy({
      by: ["repId"],
      where: {
        submittedAt: { gte: start, lte: end },
        ...scopeWhere,
      },
      _count: { id: true },
    });

    // Verified installs per rep (subset)
    const verifiedByRep = await db.sale.groupBy({
      by: ["repId"],
      where: {
        status: "VERIFIED",
        submittedAt: { gte: start, lte: end },
        ...scopeWhere,
      },
      _count: { id: true },
    });

    const verifiedMap = new Map(
      verifiedByRep.map((r) => [r.repId, r._count.id])
    );

    // Get rep details — universe is anyone with any sales in period
    const repIds = totalSalesByRep.map((r) => r.repId);
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
    const rows = totalSalesByRep
      .filter((r) => !heldRepIds.has(r.repId) && !suspendedRepIds.has(r.repId))
      .map((r) => {
        const rep = repMap.get(r.repId);
        const totalSales = r._count.id;
        const verifiedInstalls = verifiedMap.get(r.repId) ?? 0;
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
      .sort((a, b) =>
        b.verifiedInstalls - a.verifiedInstalls || b.sales - a.sales
      )
      .map((row, idx) => ({ ...row, rank: idx + 1 }));

    // Filter options for the UI dropdowns. Blitz doubles as "Team" for now
    // (per Teki — a standalone team grouping is a later build).
    const [blitzes, markets] = await Promise.all([
      db.blitz.findMany({ select: { id: true, name: true, marketId: true }, orderBy: { name: "asc" } }),
      db.market.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({
      period,
      from: from && to ? from.toISOString() : null,
      to: from && to ? to.toISOString() : null,
      rows,
      options: { blitzes, markets },
    });
  } catch (error) {
    console.error("[GET /api/leaderboard]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
