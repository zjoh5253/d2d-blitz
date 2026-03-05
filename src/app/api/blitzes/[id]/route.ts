import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    await db.blitz.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[blitzes/[id] DELETE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
