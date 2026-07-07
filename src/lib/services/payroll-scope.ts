import { db } from "@/lib/db";

/**
 * Resolve the reps a manager/owner may run payroll for. There is no direct
 * manager↔rep link: a FIELD_MANAGER's downline is the reps assigned to blitzes
 * they manage; a MARKET_OWNER's is the reps assigned to blitzes in markets they
 * own. Other roles have no downline.
 */
export async function getPayrollScope(user: {
  id: string;
  role: string;
}): Promise<{ repIds: string[] }> {
  let blitzIds: string[] = [];

  if (user.role === "FIELD_MANAGER") {
    const blitzes = await db.blitz.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    blitzIds = blitzes.map((b) => b.id);
  } else if (user.role === "MARKET_OWNER") {
    const blitzes = await db.blitz.findMany({
      where: { market: { ownerId: user.id } },
      select: { id: true },
    });
    blitzIds = blitzes.map((b) => b.id);
  } else {
    return { repIds: [] };
  }

  if (blitzIds.length === 0) return { repIds: [] };

  const assignments = await db.blitzAssignment.findMany({
    where: { blitzId: { in: blitzIds } },
    select: { repId: true },
  });

  return { repIds: [...new Set(assignments.map((a) => a.repId))] };
}
