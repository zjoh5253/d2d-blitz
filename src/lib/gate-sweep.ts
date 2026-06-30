// Fiber Blitz OS v2 — Sprint 8: gate sweep (the consequence engine).
//
// Marks overdue PENDING gates per the spec §9 "On Miss" column, then applies
// the downstream effect: G1 (roster lock) auto-reopens the slot to the board;
// G2/G3 escalate to the blitz manager (the Team Lead inbox UI is a follow-up);
// G4 stays a no-show (its penalty flows through the readiness recompute).
// Idempotent — only PENDING gates are processed, and each transitions once.

import { db } from "@/lib/db";
import { reflowWaitlist } from "@/lib/blitz-signups";
import { recomputeReadiness } from "@/lib/gates";

const REOPEN_GATES = new Set(["G1"]); // miss -> slot reopens
const ESCALATE_GATES = new Set(["G2", "G3"]); // miss -> manager/TL

export async function sweepGates(now: Date = new Date()): Promise<{ missed: number; reopened: number; escalated: number }> {
  const due = await db.checkInGate.findMany({
    where: { status: "PENDING", scheduledTriggerTime: { lte: now } },
    select: {
      id: true,
      gateId: true,
      slot: { select: { id: true, repId: true, blitzId: true, status: true } },
    },
  });

  let missed = 0;
  let reopened = 0;
  let escalated = 0;
  const affectedReps = new Set<string>();

  for (const g of due) {
    const escalate = ESCALATE_GATES.has(g.gateId);
    let escalationTargetId: string | null = null;
    if (escalate) {
      const blitz = await db.blitz.findUnique({ where: { id: g.slot.blitzId }, select: { managerId: true } });
      escalationTargetId = blitz?.managerId ?? null;
    }

    await db.checkInGate.update({
      where: { id: g.id },
      data: { status: escalate ? "ESCALATED" : "MISSED", ...(escalationTargetId ? { escalationTargetId } : {}) },
    });
    missed++;
    affectedReps.add(g.slot.repId);
    if (escalate) escalated++;

    if (REOPEN_GATES.has(g.gateId)) {
      const didReopen = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM blitzes WHERE id = ${g.slot.blitzId} FOR UPDATE`;
        const s = await tx.blitzSignup.findUnique({ where: { id: g.slot.id } });
        if (!s || (s.status !== "CLAIMED" && s.status !== "ACTIVE")) return false;
        // CLAIMED/ACTIVE occupy a spot → freeing one promotes the next waitlister.
        await tx.blitzSignup.update({ where: { id: s.id }, data: { status: "WITHDRAWN", waitPosition: null } });
        await tx.blitzAssignment.updateMany({
          where: { blitzId: g.slot.blitzId, repId: g.slot.repId, status: { not: "REMOVED" } },
          data: { status: "REMOVED" },
        });
        await reflowWaitlist(tx, g.slot.blitzId, { freedSpot: true, removedWaitPosition: null });
        return true;
      });
      if (didReopen) reopened++;
    }
  }

  // One readiness recompute per affected rep (misses + no-shows now counted).
  for (const repId of affectedReps) await recomputeReadiness(repId);

  return { missed, reopened, escalated };
}
