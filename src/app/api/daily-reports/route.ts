import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { startOfDay, endOfDay, parseISO } from "date-fns"

const dailyReportSchema = z.object({
  date: z.string().min(1, "Date is required"),
  blitzId: z.string().min(1, "Blitz is required"),
  doorsKnocked: z.coerce.number().int().min(0),
  conversations: z.coerce.number().int().min(0),
  goBacksRecorded: z.coerce.number().int().min(0),
  appointmentsScheduled: z.coerce.number().int().min(0),
  salesCount: z.coerce.number().int().min(0),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const repIdParam = searchParams.get("repId")
    const dateParam = searchParams.get("date")
    const blitzIdParam = searchParams.get("blitzId")

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"

    // Non-managers can only see their own reports
    const repId =
      isManager && repIdParam ? repIdParam : session.user.id

    const where: Record<string, unknown> = { repId }

    if (blitzIdParam) {
      where.blitzId = blitzIdParam
    }

    if (dateParam) {
      const parsed = parseISO(dateParam)
      where.date = {
        gte: startOfDay(parsed),
        lte: endOfDay(parsed),
      }
    }

    const reports = await db.dailyReport.findMany({
      where,
      include: { blitz: true, rep: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error("[GET /api/daily-reports]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = dailyReportSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      date,
      blitzId,
      doorsKnocked,
      conversations,
      goBacksRecorded,
      appointmentsScheduled,
      salesCount,
    } = parsed.data

    const repId = session.user.id
    const reportDate = startOfDay(parseISO(date))

    // Check the rep is assigned to this blitz
    const assignment = await db.blitzAssignment.findFirst({
      where: { repId, blitzId },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "You are not assigned to this blitz." },
        { status: 403 }
      )
    }

    // Upsert: if report exists for same repId+blitzId+date, update it
    const existing = await db.dailyReport.findFirst({
      where: {
        repId,
        blitzId,
        date: {
          gte: startOfDay(reportDate),
          lte: endOfDay(reportDate),
        },
      },
    })

    let report
    if (existing) {
      report = await db.dailyReport.update({
        where: { id: existing.id },
        data: {
          doorsKnocked,
          conversations,
          goBacksRecorded,
          appointmentsScheduled,
          salesCount,
          submittedAt: new Date(),
        },
      })
    } else {
      report = await db.dailyReport.create({
        data: {
          repId,
          blitzId,
          date: reportDate,
          doorsKnocked,
          conversations,
          goBacksRecorded,
          appointmentsScheduled,
          salesCount,
        },
      })
    }

    return NextResponse.json(report, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error("[POST /api/daily-reports]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
