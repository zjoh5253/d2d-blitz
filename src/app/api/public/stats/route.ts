import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [activeMarkets, fieldReps, verifiedSales, doorsThisMonth] =
      await Promise.all([
        db.market.count({ where: { status: "ACTIVE" } }),
        db.user.count({ where: { role: "FIELD_REP", status: "ACTIVE" } }),
        db.sale.findMany({
          where: { status: "VERIFIED" },
          include: { carrier: true },
        }),
        db.touchpoint.count({ where: { timestamp: { gte: thirtyDaysAgo } } }),
      ]);

    const totalRevenue = verifiedSales.reduce(
      (sum, sale) => sum + sale.carrier.revenuePerInstall,
      0
    );

    return NextResponse.json({
      activeMarkets,
      fieldReps,
      totalRevenue,
      doorsThisMonth,
    });
  } catch (error) {
    console.error("[public/stats] failed:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
