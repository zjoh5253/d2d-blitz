import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const MANAGER_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"]

type RouteParams = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  outcome: z
    .enum([
      "NO_ANSWER",
      "NOT_INTERESTED",
      "CALLBACK",
      "PITCHED",
      "SOLD",
      "DO_NOT_KNOCK",
    ])
    .optional(),
  notes: z.string().optional().or(z.literal("")),
  address: z.string().min(1).optional(),
})

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const touchpoint = await db.touchpoint.findUnique({
      where: { id },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        blitz: { select: { id: true, name: true } },
      },
    })

    if (!touchpoint) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isManager = MANAGER_ROLES.includes(session.user.role as string)
    if (!isManager && touchpoint.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(touchpoint)
  } catch (error) {
    console.error("[GET /api/touchpoints/:id]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const touchpoint = await db.touchpoint.findUnique({ where: { id } })

    if (!touchpoint) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isManager = MANAGER_ROLES.includes(session.user.role as string)
    if (!isManager && touchpoint.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const updated = await db.touchpoint.update({
      where: { id },
      data: {
        ...(parsed.data.outcome !== undefined && { outcome: parsed.data.outcome }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
        ...(parsed.data.address !== undefined && { address: parsed.data.address }),
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        blitz: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PATCH /api/touchpoints/:id]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
