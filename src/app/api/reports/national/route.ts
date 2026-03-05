import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      totalVerifiedInstalls,
      activeReps,
      activeBlitzes,
      allSales,
      monthlyCounts,
      byCarrier,
    ] = await Promise.all([
      db.sale.count({ where: { status: "VERIFIED" } }),
      db.user.count({ where: { status: "ACTIVE", role: "FIELD_REP" } }),
      db.blitz.count({ where: { status: "ACTIVE" } }),
      db.sale.findMany({
        where: { status: "VERIFIED" },
        include: {
          carrier: { select: { name: true, revenuePerInstall: true } },
        },
      }),
      db.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT TO_CHAR(DATE_TRUNC('month', "submitted_at"), 'Mon YYYY') AS month,
               COUNT(*) AS count
        FROM sales
        WHERE status = 'VERIFIED'
        GROUP BY DATE_TRUNC('month', "submitted_at")
        ORDER BY DATE_TRUNC('month', "submitted_at") ASC
        LIMIT 12
      `,
      db.$queryRaw<Array<{ carrier: string; installs: bigint }>>`
        SELECT c.name AS carrier, COUNT(*) AS installs
        FROM sales s
        JOIN carriers c ON s."carrier_id" = c.id
        WHERE s.status = 'VERIFIED'
        GROUP BY c.name
        ORDER BY installs DESC
      `,
    ]);

    // Calculate total revenue from verified installs
    const totalRevenue = allSales.reduce(
      (sum, s) => sum + s.carrier.revenuePerInstall,
      0
    );

    return NextResponse.json({
      stats: {
        totalVerifiedInstalls,
        totalRevenue,
        activeReps,
        activeBlitzes,
      },
      monthlyInstalls: monthlyCounts.map((r) => ({
        month: r.month,
        installs: Number(r.count),
      })),
      byCarrier: byCarrier.map((r) => ({
        carrier: r.carrier,
        installs: Number(r.installs),
      })),
    });
  } catch (error) {
    console.error("[GET /api/reports/national]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
