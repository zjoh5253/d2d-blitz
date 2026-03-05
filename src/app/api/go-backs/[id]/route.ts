import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { parseISO } from "date-fns"
type RouteParams = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  prospectName: z.string().min(1).optional(),
  prospectPhone: z.string().optional().or(z.literal("")),
  prospectAddress: z.string().min(1).optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional().or(z.literal("")),
  status: z
    .enum(["SCHEDULED", "REVISITED", "CONVERTED", "CLOSED"])
    .optional(),
})

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const goback = await db.goBack.findUnique({
      where: { id },
      include: { blitz: true, rep: { select: { id: true, name: true } } },
    })

    if (!goback) {
      return NextResponse.json({ error: "Go-back not found" }, { status: 404 })
    }

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    if (!isManager && goback.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(goback)
  } catch (error) {
    console.error("[GET /api/go-backs/[id]]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const goback = await db.goBack.findUnique({ where: { id } })

    if (!goback) {
      return NextResponse.json({ error: "Go-back not found" }, { status: 404 })
    }

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    if (!isManager && goback.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { followUpDate, ...rest } = parsed.data

    const updated = await db.goBack.update({
      where: { id },
      data: {
        ...rest,
        prospectPhone: rest.prospectPhone || null,
        notes: rest.notes || null,
        ...(followUpDate ? { followUpDate: parseISO(followUpDate) } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PUT /api/go-backs/[id]]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const goback = await db.goBack.findUnique({ where: { id } })

    if (!goback) {
      return NextResponse.json({ error: "Go-back not found" }, { status: 404 })
    }

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    if (!isManager && goback.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.goBack.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DELETE /api/go-backs/[id]]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
