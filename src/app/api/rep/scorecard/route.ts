import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { startOfDay, startOfWeek, endOfDay } from "date-fns"

// Composite rep performance scorecard. Returns hours, sales, and knock
// counts across three windows (today, this week, per active blitz)
// plus sales-per-hour ratios. Drives Teki's section-3 ask: reps need
// hour totals and sales-per-hour visible in the app.
//
// Hours: aggregated from gps_sessions.durationSeconds (already net of
// paused time, so this is "active work" only).
// Sales: counted from sales submitted by this rep in the window.
// Knocks: gps_sessions.knockCount sum, plus door_knock_leads resolved
// non-PENDING in the window.
//
// "Per active blitz" hours are approximate — gps_sessions doesn't
// carry a blitzId, so we attribute by date overlap with the blitz's
// start/end. If a rep works in two simultaneous blitzes the same
// hour counts toward both; documented behavior, easy to fix later
// by adding gps_sessions.blitz_id.

type WindowStats = {
  hours: number
  sales: number
  knocks: number
  salesPerHour: number | null
}

type BlitzStats = WindowStats & {
  blitzId: string
  blitzName: string
  marketName: string
  carrierName: string
  startDate: string
  endDate: string
  status: string
}

interface ScorecardResponse {
  repId: string
  today: WindowStats
  week: WindowStats
  blitzes: BlitzStats[]
}

function computeWindow(
  sessions: Array<{ durationSeconds: number; knockCount: number }>,
  salesCount: number
): WindowStats {
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0)
  const hours = totalSeconds / 3600
  const knocks = sessions.reduce((sum, s) => sum + s.knockCount, 0)
  const salesPerHour = hours > 0 ? salesCount / hours : null
  return { hours, sales: salesCount, knocks, salesPerHour }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Managers can pull any rep's scorecard via ?repId=. Reps see only
    // their own.
    const { searchParams } = new URL(request.url)
    const repIdParam = searchParams.get("repId")
    const isManager = session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    const repId = isManager && repIdParam ? repIdParam : session.user.id!

    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    // Week starts Monday — matches the convention most ops dashboards use.
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })

    // Pull all blitz assignments that are still considered "active" by
    // operational status — anything past staffing but not yet closed.
    const activeAssignments = await db.blitzAssignment.findMany({
      where: {
        repId,
        blitz: { status: { in: ["READY", "ACTIVE", "REVIEW"] } },
      },
      include: {
        blitz: {
          include: {
            market: { include: { carrier: true } },
          },
        },
      },
    })

    // Hours: gps_sessions in window.
    const sessionsToday = await db.gpsSession.findMany({
      where: { repId, startedAt: { gte: todayStart, lte: todayEnd } },
      select: { durationSeconds: true, knockCount: true },
    })
    const sessionsWeek = await db.gpsSession.findMany({
      where: { repId, startedAt: { gte: weekStart } },
      select: { durationSeconds: true, knockCount: true, startedAt: true },
    })

    // Sales: submitted by this rep in window.
    const salesToday = await db.sale.count({
      where: { repId, submittedAt: { gte: todayStart, lte: todayEnd } },
    })
    const salesWeek = await db.sale.count({
      where: { repId, submittedAt: { gte: weekStart } },
    })

    const today = computeWindow(sessionsToday, salesToday)
    const week = computeWindow(sessionsWeek, salesWeek)

    // Per-blitz: hours attributed by date overlap, sales filtered by
    // Sale.blitzId (which IS tracked). See header comment for caveat
    // on hour attribution under multi-blitz overlap.
    const blitzes: BlitzStats[] = []
    for (const a of activeAssignments) {
      const b = a.blitz
      const blitzSessions = sessionsWeek.filter(
        (s) => s.startedAt >= b.startDate && s.startedAt <= b.endDate
      )
      // Sales scoped by Sale.blitzId — the authoritative link, no
      // overlap ambiguity for sales.
      const blitzSalesCount = await db.sale.count({
        where: {
          repId,
          blitzId: b.id,
          submittedAt: { gte: b.startDate, lte: b.endDate },
        },
      })
      // For sessions started BEFORE this week's window but during the
      // blitz, the sessionsWeek query missed them. Re-query for the
      // full blitz window to get accurate hours.
      const allBlitzSessions = await db.gpsSession.findMany({
        where: {
          repId,
          startedAt: { gte: b.startDate, lte: b.endDate },
        },
        select: { durationSeconds: true, knockCount: true },
      })
      const stats = computeWindow(allBlitzSessions, blitzSalesCount)
      void blitzSessions  // sessionsWeek-overlap version is fallback context, currently unused
      blitzes.push({
        ...stats,
        blitzId: b.id,
        blitzName: b.name,
        marketName: b.market.name,
        carrierName: b.market.carrier.name,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        status: b.status,
      })
    }

    const response: ScorecardResponse = { repId, today, week, blitzes }
    return NextResponse.json(response)
  } catch (error) {
    console.error("[GET /api/rep/scorecard]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
