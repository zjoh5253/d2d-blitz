import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { isToday } from "date-fns"

type RouteParams = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  doorsKnocked: z.coerce.number().int().min(0).optional(),
  conversations: z.coerce.number().int().min(0).optional(),
  goBacksRecorded: z.coerce.number().int().min(0).optional(),
  appointmentsScheduled: z.coerce.number().int().min(0).optional(),
  salesCount: z.coerce.number().int().min(0).optional(),
})

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const report = await db.dailyReport.findUnique({
      where: { id },
      include: { blitz: true, rep: { select: { id: true, name: true } } },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    if (!isManager && report.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error("[GET /api/daily-reports/[id]]", error)
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
    const report = await db.dailyReport.findUnique({ where: { id } })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"

    // Only owner or manager can edit
    if (!isManager && report.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Non-managers can only edit same-day reports
    if (!isManager && !isToday(report.date)) {
      return NextResponse.json(
        { error: "Reports can only be edited on the day they were submitted." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await db.dailyReport.update({
      where: { id },
      data: {
        ...parsed.data,
        submittedAt: new Date(),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PUT /api/daily-reports/[id]]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
