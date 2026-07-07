import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyBlitzAssigned } from "@/lib/services/notifications"
import { captureApiError } from "@/lib/sentry"

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

    if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
    captureApiError(error, "[assignments GET]")
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

    if (!["ADMIN", "EXECUTIVE", "MARKET_OWNER", "FIELD_MANAGER"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
    const blitz = await db.blitz.findUnique({
      where: { id },
      select: { id: true, name: true, leadPrepStatus: true },
    })
    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    }

    // Hard-block staffing until lead filtering finishes, so reps are never
    // assigned to a blitz that still contains current customers / unreachable
    // addresses. Matches the FILTERING state shown on the blitz list.
    if (blitz.leadPrepStatus === "FILTERING") {
      return NextResponse.json(
        { error: "This blitz is still filtering out current customers. Staffing unlocks once filtering completes." },
        { status: 409 }
      )
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

    // Fire-and-forget push notification (don't fail the request if this errors)
    notifyBlitzAssigned({
      repId,
      blitzId: id,
      blitzName: blitz.name,
    }).catch((err) => console.error("[assignments POST] push notification failed:", err))

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error("[assignments POST]", error)
    captureApiError(error, "[assignments POST]")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
