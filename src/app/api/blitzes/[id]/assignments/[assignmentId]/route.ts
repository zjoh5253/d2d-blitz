import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const assignmentUpdateSchema = z.object({
  status: z
    .enum(["ASSIGNED", "CONFIRMED", "IN_TRANSIT", "ACTIVE", "DEPARTED", "REMOVED"])
    .optional(),
  housingAssignment: z.string().optional().or(z.literal("")),
  travelCoordination: z.string().optional().or(z.literal("")),
  arrivalConfirmed: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { assignmentId } = await params
    const body = await request.json()
    const parsed = assignmentUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { housingAssignment, travelCoordination, ...rest } = parsed.data

    const assignment = await db.blitzAssignment.update({
      where: { id: assignmentId },
      data: {
        ...rest,
        ...(housingAssignment !== undefined && { housingAssignment: housingAssignment || null }),
        ...(travelCoordination !== undefined && { travelCoordination: travelCoordination || null }),
      },
      include: {
        rep: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    return NextResponse.json(assignment)
  } catch (error) {
    console.error("[assignments/[assignmentId] PUT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { assignmentId } = await params

    await db.blitzAssignment.delete({ where: { id: assignmentId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[assignments/[assignmentId] DELETE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
