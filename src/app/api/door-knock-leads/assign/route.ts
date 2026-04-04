import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

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
