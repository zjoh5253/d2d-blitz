import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const assignmentCreateSchema = z.object({
  repId: z.string().min(1, "Rep is required"),
  housingAssignment: z.string().optional().or(z.literal("")),
  travelCoordination: z.string().optional().or(z.literal("")),
  arrivalConfirmed: z.boolean().optional().default(false),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const assignments = await db.blitzAssignment.findMany({
      where: { blitzId: id },
      include: {
        rep: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(assignments)
  } catch (error) {
    console.error("[assignments GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = assignmentCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { repId, housingAssignment, travelCoordination, arrivalConfirmed } = parsed.data

    // Check blitz exists
    const blitz = await db.blitz.findUnique({ where: { id }, select: { id: true } })
    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    }

    // Check not already assigned
    const existing = await db.blitzAssignment.findFirst({
      where: { blitzId: id, repId },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Rep is already assigned to this blitz" },
        { status: 409 }
      )
    }

    const assignment = await db.blitzAssignment.create({
      data: {
        blitzId: id,
        repId,
        housingAssignment: housingAssignment || null,
        travelCoordination: travelCoordination || null,
        arrivalConfirmed: arrivalConfirmed ?? false,
        status: "ASSIGNED",
      },
      include: {
        rep: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error("[assignments POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
