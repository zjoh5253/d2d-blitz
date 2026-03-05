import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [sales, expenses, byCarrierRaw] = await Promise.all([
      db.sale.findMany({
        where: { status: "VERIFIED" },
        include: {
          carrier: { select: { name: true, revenuePerInstall: true } },
        },
        orderBy: { submittedAt: "asc" },
      }),
      db.blitzExpense.findMany({
        orderBy: { date: "asc" },
      }),
      db.$queryRaw<
        Array<{ carrier: string; revenue: number; installs: bigint }>
      >`
        SELECT c.name AS carrier,
               SUM(c."revenue_per_install") AS revenue,
               COUNT(*) AS installs
        FROM sales s
        JOIN carriers c ON s."carrier_id" = c.id
        WHERE s.status = 'VERIFIED'
        GROUP BY c.name
        ORDER BY revenue DESC
      `,
    ]);

    // Build monthly revenue vs expenses
    const monthlyMap = new Map<
      string,
      { month: string; revenue: number; expenses: number }
    >();

    for (const sale of sales) {
      const key = `${sale.submittedAt.getFullYear()}-${String(sale.submittedAt.getMonth() + 1).padStart(2, "0")}`;
      const label = sale.submittedAt.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      const existing = monthlyMap.get(key) ?? { month: label, revenue: 0, expenses: 0 };
      existing.revenue += sale.carrier.revenuePerInstall;
      monthlyMap.set(key, existing);
    }

    for (const expense of expenses) {
      const key = `${expense.date.getFullYear()}-${String(expense.date.getMonth() + 1).padStart(2, "0")}`;
      const label = expense.date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      const existing = monthlyMap.get(key) ?? { month: label, revenue: 0, expenses: 0 };
      existing.expenses += expense.amount;
      monthlyMap.set(key, existing);
    }

    const monthlyData = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        ...v,
        margin:
          v.revenue > 0
            ? Math.round(((v.revenue - v.expenses) / v.revenue) * 100)
            : 0,
      }));

    // Total stats
    const totalRevenue = sales.reduce(
      (s, sale) => s + sale.carrier.revenuePerInstall,
      0
    );
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const overallMargin =
      totalRevenue > 0
        ? Math.round(((totalRevenue - totalExpenses) / totalRevenue) * 100)
        : 0;

    // By carrier with expenses (rough proportional split)
    const carrierBreakdown = byCarrierRaw.map((c) => ({
      carrier: c.carrier,
      revenue: Number(c.revenue),
      installs: Number(c.installs),
      margin:
        Number(c.revenue) > 0
          ? Math.round(
              ((Number(c.revenue) - totalExpenses / byCarrierRaw.length) /
                Number(c.revenue)) *
                100
            )
          : 0,
    }));

    const highestMarginCarrier =
      carrierBreakdown.length > 0
        ? carrierBreakdown.reduce((a, b) => (a.margin > b.margin ? a : b))
            .carrier
        : "N/A";

    const lowestMarginCarrier =
      carrierBreakdown.length > 0
        ? carrierBreakdown.reduce((a, b) => (a.margin < b.margin ? a : b))
            .carrier
        : "N/A";

    return NextResponse.json({
      stats: {
        overallMargin,
        totalRevenue,
        totalExpenses,
        highestMarginCarrier,
        lowestMarginCarrier,
      },
      monthlyData,
      carrierBreakdown,
    });
  } catch (error) {
    console.error("[GET /api/reports/margins]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
