import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { reflowWaitlist } from "@/lib/blitz-signups"

// Manager declines / removes a rep's job-board signup. Frees the spot and
// promotes the next waitlister. If the rep was already ACTIVE (territory
// assigned), also un-assigns their leads and marks their BlitzAssignment
// REMOVED so the blitz reflects the removal. Admin / FIELD_MANAGER only.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; repId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id: blitzId, repId } = await params
    const managerId = session.user.id

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM blitzes WHERE id = ${blitzId} FOR UPDATE`
      const s = await tx.blitzSignup.findUnique({ where: { blitzId_repId: { blitzId, repId } } })
      if (!s || s.status === "DECLINED" || s.status === "WITHDRAWN") return

      const freedSpot = s.status === "CLAIMED" || s.status === "ACTIVE"
      const wasPos = s.waitPosition

      await tx.blitzSignup.update({
        where: { id: s.id },
        data: { status: "DECLINED", waitPosition: null, decidedById: managerId, decidedAt: new Date() },
      })

      // An active rep already has territory — release their leads + assignment.
      if (s.status === "ACTIVE") {
        await tx.doorKnockLead.updateMany({ where: { blitzId, assignedRepId: repId }, data: { assignedRepId: null } })
        await tx.blitzAssignment.updateMany({ where: { blitzId, repId }, data: { status: "REMOVED" } })
      }

      await reflowWaitlist(tx, blitzId, { freedSpot, removedWaitPosition: wasPos })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/blitzes/:id/signups/:repId/decline]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
