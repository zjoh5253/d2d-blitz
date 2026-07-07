import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { captureApiError } from "@/lib/sentry"

const blitzUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  marketId: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  repCap: z.coerce.number().int().positive().optional(),
  housingPlan: z.string().optional().or(z.literal("")),
  managerId: z.string().min(1).optional(),
  status: z.enum(["PLANNING", "STAFFING", "READY", "ACTIVE", "REVIEW", "CLOSED"]).optional(),
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

    const blitz = await db.blitz.findUnique({
      where: { id },
      include: {
        market: { include: { carrier: true } },
        manager: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            rep: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        expenses: { orderBy: { date: "desc" } },
        sales: {
          include: {
            rep: { select: { id: true, name: true } },
            commissionRecord: true,
          },
          orderBy: { submittedAt: "desc" },
        },
      },
    })

    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    }

    return NextResponse.json(blitz)
  } catch (error) {
    console.error("[blitzes/[id] GET]", error)
    captureApiError(error, "[blitzes/[id] GET]")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
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
    const parsed = blitzUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { startDate, endDate, housingPlan, ...rest } = parsed.data

    const blitz = await db.blitz.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(housingPlan !== undefined && { housingPlan: housingPlan || null }),
      },
      include: {
        market: { include: { carrier: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(blitz)
  } catch (error) {
    console.error("[blitzes/[id] PUT]", error)
    captureApiError(error, "[blitzes/[id] PUT]")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const blitz = await db.blitz.findUnique({ where: { id }, select: { status: true } })
    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    }
    if (blitz.status !== "PLANNING") {
      return NextResponse.json(
        { error: "Only blitzes in PLANNING status can be deleted" },
        { status: 400 }
      )
    }

    // Block deletion if the blitz has real work attached (these FKs are
    // RESTRICT and a PLANNING test blitz shouldn't have any).
    const [assignments, sales, reports] = await Promise.all([
      db.blitzAssignment.count({ where: { blitzId: id } }),
      db.sale.count({ where: { blitzId: id } }),
      db.dailyReport.count({ where: { blitzId: id } }),
    ])
    if (assignments + sales + reports > 0) {
      return NextResponse.json(
        { error: "This blitz has reps, sales, or reports attached — remove those before deleting." },
        { status: 409 }
      )
    }

    // door_knock_leads / gps_sessions are ON DELETE SET NULL, so a bare
    // blitz.delete would ORPHAN every imported lead (blitz_id → NULL) into the
    // pool. Delete them first so nothing is left behind. All-or-nothing.
    const [leads] = await db.$transaction([
      db.doorKnockLead.deleteMany({ where: { blitzId: id } }),
      db.gpsSession.deleteMany({ where: { blitzId: id } }),
      db.blitz.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true, deletedLeads: leads.count })
  } catch (error) {
    console.error("[blitzes/[id] DELETE]", error)
    captureApiError(error, "[blitzes/[id] DELETE]")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
