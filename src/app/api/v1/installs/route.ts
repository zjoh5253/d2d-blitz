import { NextRequest, NextResponse } from "next/server";
import { withApiKey, pageParams } from "@/lib/api-key";
import { db } from "@/lib/db";

// GET /api/v1/installs — install records for reconciliation (Coastside).
// Params: ?limit=1..500 (default 100) · ?since=ISO (installDate/createdAt delta)
// · ?carrierId · ?status. Scope: installs:read.
export async function GET(req: NextRequest) {
  return withApiKey(req, "installs:read", async () => {
    const url = new URL(req.url);
    const { limit, since } = pageParams(url);
    const carrierId = url.searchParams.get("carrierId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;

    const rows = await db.installRecord.findMany({
      where: {
        ...(carrierId ? { carrierId } : {}),
        ...(status ? { status: status as never } : {}),
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { carrier: { select: { id: true, name: true } } },
    });

    const installs = rows.map((r) => ({
      id: r.id,
      externalId: r.externalId,
      carrier: { id: r.carrier.id, name: r.carrier.name },
      customerName: r.customerName,
      customerAddress: r.customerAddress,
      installDate: r.installDate?.toISOString() ?? null,
      status: r.status,
      orderStatus: r.orderStatus,
      repId: r.repId,
      repName: r.repName,
      matchedSaleId: r.matchedSaleId,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ count: installs.length, installs });
  });
}
