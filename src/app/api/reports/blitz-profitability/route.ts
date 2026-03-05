import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blitzes = await db.blitz.findMany({
      include: {
        market: {
          select: {
            name: true,
            carrier: { select: { name: true, revenuePerInstall: true } },
          },
        },
        expenses: { select: { amount: true } },
        sales: {
          where: { status: "VERIFIED" },
          select: { id: true },
        },
        assignments: {
          where: { status: { not: "REMOVED" } },
          select: { repId: true },
        },
      },
      orderBy: { startDate: "desc" },
    });

    const blitzData = blitzes.map((blitz) => {
      const totalExpenses = blitz.expenses.reduce((s, e) => s + e.amount, 0);
      const verifiedInstalls = blitz.sales.length;
      const revenue =
        verifiedInstalls * blitz.market.carrier.revenuePerInstall;
      const profit = revenue - totalExpenses;
      const marginPercent =
        revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
      const repCount = new Set(blitz.assignments.map((a) => a.repId)).size;
      const revenuePerRep = repCount > 0 ? Math.round(revenue / repCount) : 0;
      const installsPerRep =
        repCount > 0 ? Math.round(verifiedInstalls / repCount) : 0;

      return {
        id: blitz.id,
        name: blitz.name,
        market: blitz.market.name,
        carrier: blitz.market.carrier.name,
        status: blitz.status,
        revenue,
        expenses: totalExpenses,
        profit,
        marginPercent,
        verifiedInstalls,
        repCount,
        revenuePerRep,
        installsPerRep,
      };
    });

    // Sort by profit desc for top 10
    const sortedByProfit = [...blitzData].sort((a, b) => b.profit - a.profit);

    return NextResponse.json({
      blitzes: blitzData,
      top10ByProfit: sortedByProfit.slice(0, 10),
    });
  } catch (error) {
    console.error("[GET /api/reports/blitz-profitability]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
