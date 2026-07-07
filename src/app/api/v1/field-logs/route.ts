import { NextRequest, NextResponse } from "next/server";
import { withApiKey, pageParams } from "@/lib/api-key";
import { db } from "@/lib/db";

// GET /api/v1/field-logs — door-knock field activity (dispositions + coords) for
// reconciliation. Params: ?limit=1..500 (default 100) · ?since=ISO (updatedAt
// delta) · ?blitzId · ?disposition. Scope: field-logs:read.
export async function GET(req: NextRequest) {
  return withApiKey(req, "field-logs:read", async () => {
    const url = new URL(req.url);
    const { limit, since } = pageParams(url);
    const blitzId = url.searchParams.get("blitzId") ?? undefined;
    const disposition = url.searchParams.get("disposition") ?? undefined;

    const rows = await db.doorKnockLead.findMany({
      where: {
        ...(blitzId ? { blitzId } : {}),
        ...(disposition ? { disposition: disposition as never } : {}),
        ...(since ? { updatedAt: { gte: since } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { assignedRep: { select: { id: true, name: true } } },
    });

    const logs = rows.map((r) => ({
      id: r.id,
      address: `${r.streetNumber} ${r.streetName}`.trim(),
      city: r.city,
      state: r.state,
      zip: r.zip,
      lat: r.lat,
      lng: r.lng,
      disposition: r.disposition,
      blitzId: r.blitzId,
      rep: r.assignedRep ? { id: r.assignedRep.id, name: r.assignedRep.name } : null,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({ count: logs.length, fieldLogs: logs });
  });
}
