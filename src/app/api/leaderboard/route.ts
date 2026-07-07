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

  // "all" / "lifetime" / "season" / default
  return { start: new Date(0), end: endOfDay(now) };
}

// The metrics the board can rank by. `installs` is the default (keeps the admin
// dashboard — which passes no metric — ranking by verified installs as before).
type Metric = "installs" | "sales" | "knocks" | "sph" | "points";
const METRICS: Metric[] = ["installs", "sales", "knocks", "sph", "points"];

// Gamified score: every door knocked is worth a point, a submitted sale 50,
// and a verified install another 50 on top (so a closed-and-installed deal = 100).
function pointsFor(d: { sales: number; verifiedInstalls: number; knocks: number }): number {
  return d.knocks * 1 + d.sales * 50 + d.verifiedInstalls * 50;
}

// UTC day key — used for streak bucketing (motivational, not financial, so a
// fixed UTC day is fine and keeps it deterministic across server timezones).
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Shared sort for a given metric, used by both the live board and the
// previous-period ranking that drives the movement (▲/▼) arrows.
type Rankable = { sales: number; verifiedInstalls: number; knocks: number; salesPerHour: number | null };
function cmpFor(metric: Metric): (a: Rankable, b: Rankable) => number {
  switch (metric) {
    case "sales": return (a, b) => b.sales - a.sales || b.verifiedInstalls - a.verifiedInstalls;
    case "knocks": return (a, b) => b.knocks - a.knocks || b.sales - a.sales;
    case "sph": return (a, b) => (b.salesPerHour ?? -1) - (a.salesPerHour ?? -1) || b.sales - a.sales;
    case "points": return (a, b) => pointsFor(b) - pointsFor(a) || b.verifiedInstalls - a.verifiedInstalls;
    default: return (a, b) => b.verifiedInstalls - a.verifiedInstalls || b.sales - a.sales; // installs
  }
}

// Rank a window the same way the live board does and return repId → rank.
// Used only for the immediately-preceding period so we can show movement.
async function rankWindow(
  scope: Record<string, unknown>,
  excluded: Set<string>,
  start: Date,
  end: Date,
  metric: Metric
): Promise<Map<string, number>> {
  const [sales, verified, gps] = await Promise.all([
    db.sale.groupBy({ by: ["repId"], where: { submittedAt: { gte: start, lte: end }, ...scope }, _count: { id: true } }),
    db.sale.groupBy({ by: ["repId"], where: { status: "VERIFIED", submittedAt: { gte: start, lte: end }, ...scope }, _count: { id: true } }),
    db.gpsSession.groupBy({ by: ["repId"], where: { startedAt: { gte: start, lte: end }, ...scope }, _sum: { durationSeconds: true, knockCount: true } }),
  ]);
  const sMap = new Map(sales.map((r) => [r.repId, r._count.id]));
  const vMap = new Map(verified.map((r) => [r.repId, r._count.id]));
  const gMap = new Map(gps.map((r) => [r.repId, { secs: r._sum.durationSeconds ?? 0, knocks: r._sum.knockCount ?? 0 }]));
  const ids = new Set<string>([...sMap.keys(), ...gMap.keys()]);
  for (const id of excluded) ids.delete(id);
  const rows = [...ids].map((id) => {
    const sales = sMap.get(id) ?? 0;
    const verifiedInstalls = vMap.get(id) ?? 0;
    const g = gMap.get(id) ?? { secs: 0, knocks: 0 };
    const hours = g.secs / 3600;
    return { id, sales, verifiedInstalls, knocks: g.knocks, salesPerHour: hours > 0 ? sales / hours : null };
  });
  rows.sort(cmpFor(metric));
  return new Map(rows.map((r, i) => [r.id, i + 1]));
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
    const metricParam = searchParams.get("metric");
    const metric: Metric = METRICS.includes(metricParam as Metric) ? (metricParam as Metric) : "installs";

    // Custom range wins over the preset. Date-only inputs are bounded in UTC so
    // day edges are stable regardless of server timezone.
    let start: Date, end: Date;
    const dateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (fromParam && toParam) {
      start = dateOnly(fromParam) ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(fromParam);
      end = dateOnly(toParam) ? new Date(`${toParam}T23:59:59.999Z`) : new Date(toParam);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) ({ start, end } = getPeriodDates(period));
    } else {
      ({ start, end } = getPeriodDates(period));
    }

    // Compliance holds + governance suspensions are excluded from the board.
    const [heldReps, suspended] = await Promise.all([
      db.complianceHold.findMany({ where: { restoredDate: null }, select: { repId: true } }),
      db.governancePeriod.findMany({ where: { consecutiveStrikes: { gte: 2 } }, select: { repId: true }, distinct: ["repId"] }),
    ]);
    const excluded = new Set([...heldReps.map((h) => h.repId), ...suspended.map((p) => p.repId)]);

    // Scope filter — shared shape across sales, gps sessions, and assignments.
    // blitz wins over market; repId narrows further.
    const scope: Record<string, unknown> = {
      ...(blitzId ? { blitzId } : marketId ? { blitz: { marketId } } : {}),
      ...(repId ? { repId } : {}),
    };

    const [totalSalesByRep, verifiedByRep, gpsByRep, assigned] = await Promise.all([
      db.sale.groupBy({ by: ["repId"], where: { submittedAt: { gte: start, lte: end }, ...scope }, _count: { id: true } }),
      db.sale.groupBy({ by: ["repId"], where: { status: "VERIFIED", submittedAt: { gte: start, lte: end }, ...scope }, _count: { id: true } }),
      db.gpsSession.groupBy({ by: ["repId"], where: { startedAt: { gte: start, lte: end }, ...scope }, _sum: { durationSeconds: true, knockCount: true } }),
      // Universe of "active" reps for this scope, so everyone gets a rank to
      // climb (not just reps who already sold). Reps on a blitz in scope.
      db.blitzAssignment.findMany({ where: { ...scope }, select: { repId: true }, distinct: ["repId"] }),
    ]);

    const salesMap = new Map(totalSalesByRep.map((r) => [r.repId, r._count.id]));
    const verifiedMap = new Map(verifiedByRep.map((r) => [r.repId, r._count.id]));
    const gpsMap = new Map(gpsByRep.map((r) => [r.repId, { secs: r._sum.durationSeconds ?? 0, knocks: r._sum.knockCount ?? 0 }]));

    const now = new Date();

    // Movement: rank the immediately-preceding equal-length window so each row
    // can show ▲/▼ vs last period. Skipped for "all time" (epoch start) and
    // absurdly long custom ranges where a "previous period" is meaningless.
    const windowMs = end.getTime() - start.getTime();
    let prevRankMap = new Map<string, number>();
    if (start.getTime() > 0 && windowMs > 0 && windowMs < 366 * 86_400_000) {
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(start.getTime() - windowMs - 1);
      prevRankMap = await rankWindow(scope, excluded, prevStart, prevEnd, metric);
    }

    // Streaks: consecutive days (UTC) with a knock or a sale, over a trailing
    // 30-day window in the same scope — independent of the selected period so
    // it always reflects the rep's current momentum.
    const streakStart = new Date(now.getTime() - 30 * 86_400_000);
    const [streakGps, streakSales] = await Promise.all([
      db.gpsSession.findMany({ where: { startedAt: { gte: streakStart }, knockCount: { gt: 0 }, ...scope }, select: { repId: true, startedAt: true } }),
      db.sale.findMany({ where: { submittedAt: { gte: streakStart }, ...scope }, select: { repId: true, submittedAt: true } }),
    ]);
    const activeDays = new Map<string, Set<string>>();
    const markDay = (repId: string, d: Date) => {
      let s = activeDays.get(repId);
      if (!s) { s = new Set(); activeDays.set(repId, s); }
      s.add(dayKey(d));
    };
    for (const g of streakGps) markDay(g.repId, g.startedAt);
    for (const s of streakSales) markDay(s.repId, s.submittedAt);
    const streakFor = (repId: string): number => {
      const days = activeDays.get(repId);
      if (!days) return 0;
      const cursor = new Date(now);
      // An in-progress today with no activity yet shouldn't break a streak.
      if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
      let n = 0;
      while (days.has(dayKey(cursor))) { n++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
      return n;
    };

    // Universe = anyone assigned in scope ∪ anyone with sales ∪ anyone who knocked.
    const universe = new Set<string>([
      ...assigned.map((a) => a.repId),
      ...totalSalesByRep.map((r) => r.repId),
      ...gpsByRep.map((r) => r.repId),
    ]);
    for (const id of excluded) universe.delete(id);

    const reps = await db.user.findMany({
      where: { id: { in: [...universe] } },
      select: { id: true, name: true, governanceTier: { select: { name: true } } },
    });

    let rows = reps.map((rep) => {
      const sales = salesMap.get(rep.id) ?? 0;
      const verifiedInstalls = verifiedMap.get(rep.id) ?? 0;
      const gps = gpsMap.get(rep.id) ?? { secs: 0, knocks: 0 };
      const hours = gps.secs / 3600;
      const knocks = gps.knocks;
      const salesPerHour = hours > 0 ? Math.round((sales / hours) * 100) / 100 : null;
      return {
        repId: rep.id,
        repName: rep.name ?? "Unknown",
        sales,
        verifiedInstalls,
        installRate: sales > 0 ? verifiedInstalls / sales : 0,
        knocks,
        hours: Math.round(hours * 10) / 10,
        salesPerHour,
        points: pointsFor({ sales, verifiedInstalls, knocks }),
        streak: streakFor(rep.id),
        prevRank: prevRankMap.get(rep.id) ?? null,
        tier: rep.governanceTier?.name ?? null,
      };
    });

    // Rank by the selected metric (default installs), then attach final rank and
    // movement (prevRank − rank; positive = climbed). prevRank null = wasn't
    // ranked last period → the client shows a "NEW" badge.
    rows = rows
      .sort(cmpFor(metric))
      .map((row, idx) => ({
        ...row,
        rank: idx + 1,
        delta: row.prevRank != null ? row.prevRank - (idx + 1) : null,
      }));

    const [blitzes, markets] = await Promise.all([
      db.blitz.findMany({ select: { id: true, name: true, marketId: true }, orderBy: { name: "asc" } }),
      db.market.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({
      period,
      metric,
      from: fromParam && toParam ? start.toISOString() : null,
      to: fromParam && toParam ? end.toISOString() : null,
      rows,
      options: { blitzes, markets },
    });
  } catch (error) {
    console.error("[GET /api/leaderboard]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
