import { NextRequest, NextResponse } from "next/server";
import { withApiKey } from "@/lib/api-key";
import { db } from "@/lib/db";

// GET /api/v1/carriers — ISP / carrier info + their markets (revenue per install,
// coverage). Scope: carriers:read. (Rep-level commission rates come from the
// compensation engine and land here once that's merged.)
export async function GET(req: NextRequest) {
  return withApiKey(req, "carriers:read", async () => {
    const rows = await db.carrier.findMany({
      orderBy: { name: "asc" },
      include: {
        markets: { select: { id: true, name: true, coverageArea: true, status: true } },
      },
    });

    const carriers = rows.map((c) => ({
      id: c.id,
      name: c.name,
      revenuePerInstall: c.revenuePerInstall,
      status: c.status,
      markets: c.markets.map((m) => ({ id: m.id, name: m.name, coverageArea: m.coverageArea, status: m.status })),
    }));

    return NextResponse.json({ count: carriers.length, carriers });
  });
}
