import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { completeGate } from "@/lib/gates";

// Rep completes a check-in gate (by CheckInGate row id, from /api/rep/gates).
// Geofence gates (G4) require { lat, lng } in the body.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const gate = await db.checkInGate.findUnique({ where: { id }, select: { blitzSlotId: true, gateId: true } });
    if (!gate) return NextResponse.json({ error: "Gate not found" }, { status: 404 });

    const result = await completeGate(gate.blitzSlotId, gate.gateId, session.user.id, {
      lat: typeof body.lat === "number" ? body.lat : undefined,
      lng: typeof body.lng === "number" ? body.lng : undefined,
    });

    if (result.code === 403) return NextResponse.json({ error: "Not your gate" }, { status: 403 });
    if (result.code === 404) return NextResponse.json({ error: result.msg ?? "Not found" }, { status: 404 });
    if (result.code === 400) return NextResponse.json({ error: result.msg }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/rep/gates/:id/complete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
