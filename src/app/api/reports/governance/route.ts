import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [tiers, users, governancePeriods] = await Promise.all([
      db.governanceTier.findMany({
        orderBy: { rank: "asc" },
      }),
      db.user.findMany({
        where: { role: "FIELD_REP", status: "ACTIVE" },
        select: {
          id: true,
          governanceTierId: true,
          governanceTier: { select: { name: true } },
          governancePeriods: {
            orderBy: [{ year: "desc" }, { month: "desc" }],
            take: 1,
            select: { isStrike: true, consecutiveStrikes: true },
          },
        },
      }),
      db.$queryRaw<
        Array<{ tier_name: string; month: number; year: number; count: bigint }>
      >`
        SELECT t.name AS tier_name, gp.month, gp.year, COUNT(*) AS count
        FROM governance_periods gp
        JOIN governance_tiers t ON gp."tier_id" = t.id
        WHERE gp.year >= EXTRACT(YEAR FROM NOW()) - 1
        GROUP BY t.name, gp.month, gp.year
        ORDER BY gp.year ASC, gp.month ASC
      `,
    ]);

    // Count reps per tier
    const tierCounts = tiers.map((tier) => ({
      tier: tier.name,
      count: users.filter((u) => u.governanceTierId === tier.id).length,
    }));

    // Strike stats
    const totalStrikes = users.filter(
      (u) =>
        u.governancePeriods[0]?.isStrike ||
        (u.governancePeriods[0]?.consecutiveStrikes ?? 0) > 0
    ).length;

    const strikeRate =
      users.length > 0
        ? Math.round((totalStrikes / users.length) * 100)
        : 0;

    // Monthly trend
    const trendMap = new Map<string, Record<string, unknown>>();
    for (const row of governancePeriods) {
      const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
      const label = new Date(Number(row.year), Number(row.month) - 1)
        .toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const existing = trendMap.get(key) ?? { period: label };
      existing[row.tier_name] = Number(row.count);
      trendMap.set(key, existing);
    }

    const tierTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return NextResponse.json({
      tierDistribution: tierCounts,
      tierTrend,
      stats: {
        totalReps: users.length,
        totalStrikes,
        strikeRate,
      },
      tierDetails: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        rank: t.rank,
        minInstallRate: t.minInstallRate,
        commissionMultiplier: t.commissionMultiplier,
        repCount: users.filter((u) => u.governanceTierId === t.id).length,
      })),
    });
  } catch (error) {
    console.error("[GET /api/reports/governance]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
