import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GATE_DEFS } from "@/lib/gates";

// Manager gate-status view (spec §5.2 at-risk roster): per-rep gate progress
// across this blitz's slots, with an at-risk flag for any missed/escalated gate.
// Admin / FIELD_MANAGER only.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    const gates = await db.checkInGate.findMany({
      where: { slot: { blitzId: id } },
      select: {
        gateId: true,
        status: true,
        scheduledTriggerTime: true,
        slot: { select: { repId: true, rep: { select: { name: true, email: true } } } },
      },
    });

    // Group by rep into a gateId -> status map.
    const byRep = new Map<string, { repId: string; repName: string; gates: Record<string, string>; atRisk: boolean }>();
    for (const g of gates) {
      const key = g.slot.repId;
      let row = byRep.get(key);
      if (!row) {
        row = { repId: key, repName: g.slot.rep.name ?? g.slot.rep.email, gates: {}, atRisk: false };
        byRep.set(key, row);
      }
      row.gates[g.gateId] = g.status;
      if (g.status === "MISSED" || g.status === "ESCALATED") row.atRisk = true;
    }

    return NextResponse.json({
      order: GATE_DEFS.map((g) => ({ id: g.id, label: g.label })),
      reps: [...byRep.values()].sort((a, b) => Number(b.atRisk) - Number(a.atRisk)),
    });
  } catch (error) {
    console.error("[GET /api/blitzes/:id/gates]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
