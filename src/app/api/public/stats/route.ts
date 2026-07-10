import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [activeMarkets, fieldReps, verifiedSales] = await Promise.all([
      db.market.count({ where: { status: "ACTIVE" } }),
      db.user.count({ where: { role: "FIELD_REP", status: "ACTIVE" } }),
      db.sale.findMany({
        where: { status: "VERIFIED" },
        include: { carrier: true },
      }),
    ]);

    // MDU model (P2): revenue scales by units_sold (1 for a single-home sale).
    const totalRevenue = verifiedSales.reduce(
      (sum, sale) => sum + sale.carrier.revenuePerInstall * (sale.unitsSold ?? 1),
      0
    );

    return NextResponse.json({ activeMarkets, fieldReps, totalRevenue });
  } catch (error) {
    console.error("[public/stats] failed:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
