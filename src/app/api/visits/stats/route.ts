import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as string;
  const isManager = ["ADMIN", "FIELD_MANAGER", "EXECUTIVE", "MARKET_OWNER"].includes(role);

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date"); // YYYY-MM-DD, optional

  const dateFilter = dateParam
    ? (() => {
        const start = new Date(dateParam);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateParam);
        end.setHours(23, 59, 59, 999);
        return { gte: start, lte: end };
      })()
    : undefined;

  const baseWhere = isManager
    ? dateFilter ? { createdAt: dateFilter } : {}
    : { repId: session.user.id, ...(dateFilter ? { createdAt: dateFilter } : {}) };

  const [totalKnocks, sales, callbacks] = await Promise.all([
    db.visit.count({ where: baseWhere }),
    db.visit.count({ where: { ...baseWhere, outcome: "SALE" } }),
    db.visit.count({ where: { ...baseWhere, outcome: "CALLBACK" } }),
  ]);

  const conversionRate = totalKnocks > 0 ? (sales / totalKnocks) * 100 : 0;

  // Leaderboard: rep name → knock count → sales count
  const leaderboard = await db.visit.groupBy({
    by: ["repId"],
    where: dateFilter ? { createdAt: dateFilter } : {},
    _count: { id: true },
  });

  const salesByRep = await db.visit.groupBy({
    by: ["repId"],
    where: { outcome: "SALE", ...(dateFilter ? { createdAt: dateFilter } : {}) },
    _count: { id: true },
  });

  const salesMap = new Map(salesByRep.map((r) => [r.repId, r._count.id]));

  const repIds = leaderboard.map((r) => r.repId);
  const repUsers = await db.user.findMany({
    where: { id: { in: repIds } },
    select: { id: true, name: true, email: true },
  });
  const repMap = new Map(repUsers.map((u) => [u.id, u]));

  const leaderboardRows = leaderboard
    .map((r) => ({
      repId: r.repId,
      repName: repMap.get(r.repId)?.name ?? repMap.get(r.repId)?.email ?? r.repId,
      knocks: r._count.id,
      sales: salesMap.get(r.repId) ?? 0,
    }))
    .sort((a, b) => b.knocks - a.knocks);

  return NextResponse.json({
    totalKnocks,
    sales,
    callbacks,
    conversionRate: Math.round(conversionRate * 10) / 10,
    leaderboard: leaderboardRows,
  });
}
