import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { scheduleGatesForSlot } from "@/lib/gates"

const assignSchema = z.object({
  leadIds: z.array(z.string()).min(1, "At least one lead is required"),
  repId: z.string().min(1, "Rep ID is required"),
})

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = assignSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { leadIds, repId } = parsed.data

    // Verify the rep exists and is a field rep
    const rep = await db.user.findUnique({ where: { id: repId } })
    if (!rep || rep.role !== "FIELD_REP") {
      return NextResponse.json(
        { error: "Invalid rep ID or user is not a field rep" },
        { status: 400 }
      )
    }

    const result = await db.doorKnockLead.updateMany({
      where: { id: { in: leadIds } },
      data: { assignedRepId: repId },
    })

    // Job board: assigning territory to a rep who CLAIMED this blitz on the
    // board activates their signup + mirrors it into a BlitzAssignment so the
    // existing staffing/counts work unchanged. No signup (the old direct-assign
    // flow) → leave behavior as-is.
    if (result.count > 0) {
      const lead = await db.doorKnockLead.findFirst({
        where: { id: { in: leadIds } },
        select: { blitzId: true },
      })
      if (lead?.blitzId) {
        const blitzId = lead.blitzId
        const signup = await db.blitzSignup.findUnique({
          where: { blitzId_repId: { blitzId, repId } },
        })
        if (signup && signup.status !== "ACTIVE" && signup.status !== "DECLINED" && signup.status !== "WITHDRAWN") {
          await db.blitzSignup.update({
            where: { id: signup.id },
            data: {
              status: "ACTIVE",
              activatedAt: new Date(),
              decidedById: session.user.id,
              decidedAt: new Date(),
              waitPosition: null,
            },
          })
          const existingAssignment = await db.blitzAssignment.findFirst({ where: { blitzId, repId } })
          if (!existingAssignment) {
            await db.blitzAssignment.create({ data: { blitzId, repId, status: "ACTIVE" } })
          }
          // Activation kicks off the check-in gate sequence (G0 auto-done).
          const b = await db.blitz.findUnique({ where: { id: blitzId }, select: { startDate: true, endDate: true } })
          if (b) await scheduleGatesForSlot(signup.id, b)
        }
      }
    }

    return NextResponse.json({
      assigned: result.count,
      repId,
      message: `Assigned ${result.count} leads to ${rep.name}`,
    })
  } catch (error) {
    console.error("[PUT /api/door-knock-leads/assign]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
