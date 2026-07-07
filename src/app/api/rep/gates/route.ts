import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { GATE_DEFS } from "@/lib/gates";

const LABELS = Object.fromEntries(GATE_DEFS.map((g) => [g.id, g.label]));

// A rep's check-in gates across their active slots — the rep app's gate list.
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const repId = session.user.id;

    const gates = await db.checkInGate.findMany({
      where: { slot: { repId } },
      orderBy: { scheduledTriggerTime: "asc" },
      select: {
        id: true,
        gateId: true,
        requiredActionType: true,
        scheduledTriggerTime: true,
        status: true,
        slot: { select: { blitz: { select: { id: true, name: true } } } },
      },
    });

    const rows = gates.map((g) => ({
      id: g.id,
      gateId: g.gateId,
      label: LABELS[g.gateId] ?? g.gateId,
      action: g.requiredActionType,
      scheduledAt: g.scheduledTriggerTime,
      status: g.status,
      blitz: { id: g.slot.blitz.id, name: g.slot.blitz.name },
    }));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("[GET /api/rep/gates]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
