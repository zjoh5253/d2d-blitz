// Shared "activate a claimed rep on a blitz" — flips their job-board signup to
// ACTIVE, mirrors a BlitzAssignment, and starts their check-in gates. Used by
// both the Door-Knocks map assignment and the in-Staffing "Assign territory"
// action, so activation behaves identically wherever it's triggered.
//
// No-op (returns false) if the rep has no active claim on the blitz.

import { db } from "@/lib/db";
import { scheduleGatesForSlot } from "@/lib/gates";

export async function activateRepOnBlitz(blitzId: string, repId: string, actorId?: string): Promise<boolean> {
  const signup = await db.blitzSignup.findUnique({ where: { blitzId_repId: { blitzId, repId } } });
  if (!signup || signup.status === "ACTIVE" || signup.status === "DECLINED" || signup.status === "WITHDRAWN") {
    return false;
  }
  await db.blitzSignup.update({
    where: { id: signup.id },
    data: { status: "ACTIVE", activatedAt: new Date(), decidedById: actorId ?? null, decidedAt: new Date(), waitPosition: null },
  });
  const existing = await db.blitzAssignment.findFirst({ where: { blitzId, repId } });
  if (!existing) await db.blitzAssignment.create({ data: { blitzId, repId, status: "ACTIVE" } });

  const blitz = await db.blitz.findUnique({ where: { id: blitzId }, select: { startDate: true, endDate: true, timezone: true } });
  if (blitz) await scheduleGatesForSlot(signup.id, blitz);
  return true;
}
