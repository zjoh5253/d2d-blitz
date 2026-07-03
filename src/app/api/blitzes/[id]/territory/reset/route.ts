import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeReadiness } from "@/lib/gates";

// Full territory reset (#1): undo an accidental / too-early assignment. Unassigns
// every lead on the blitz AND reverts any ACTIVE reps back to "reserved" —
// clearing the check-in gates that activation started — so the manager can
// re-plan from scratch. Claims/waitlist are kept (reps stay signed up, just no
// longer active). Admin / FIELD_MANAGER only.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: blitzId } = await params;

    // 1. Unassign every lead → map goes back to all-unassigned.
    const leadRes = await db.doorKnockLead.updateMany({ where: { blitzId }, data: { assignedRepId: null } });

    // 2. Deactivate reps that were activated: drop their gates, revert their
    //    signup to CLAIMED, and remove the assignment mirror.
    const active = await db.blitzSignup.findMany({ where: { blitzId, status: "ACTIVE" }, select: { id: true, repId: true } });
    for (const s of active) {
      await db.gateCompletion.deleteMany({ where: { blitzSlotId: s.id } });
      await db.checkInGate.deleteMany({ where: { blitzSlotId: s.id } });
      await db.blitzSignup.update({ where: { id: s.id }, data: { status: "CLAIMED", activatedAt: null, decidedById: null, decidedAt: null } });
      await db.blitzAssignment.deleteMany({ where: { blitzId, repId: s.repId } });
    }
    // Recompute readiness now that this blitz's gate history is cleared.
    for (const s of active) await recomputeReadiness(s.repId);

    return NextResponse.json({ ok: true, unassigned: leadRes.count, deactivated: active.length });
  } catch (error) {
    console.error("[POST /api/blitzes/:id/territory/reset]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
