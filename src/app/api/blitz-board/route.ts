import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { boardGatingEnabled, canSeeBlitz, repScoreOrDefault } from "@/lib/board-gating"

// Rep job board. By default reps see ALL open blitzes (openForSignup = true once
// lead_prep is READY). When BOARD_BAND_GATING is on, the board is filtered by
// the rep's readiness band (spec §6.2) — Locked reps see nothing, score floors
// hide blitzes, and premium-tier blitzes are premium-exclusive for 24h. Each row
// carries spots-left / waitlist size + THIS rep's own signup status.

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const repId = session.user.id

    let blitzes = await db.blitz.findMany({
      where: { openForSignup: true, status: { notIn: ["CLOSED", "REVIEW"] } },
      include: {
        market: { include: { carrier: { select: { name: true } } } },
        manager: { select: { name: true, email: true } },
        signups: { select: { repId: true, status: true, waitPosition: true } },
      },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
    })

    // Band-gating (flag-gated): hide blitzes this rep's score can't access.
    if (boardGatingEnabled()) {
      const me = await db.user.findUnique({ where: { id: repId }, select: { blitzReadinessScore: true } })
      const score = repScoreOrDefault(me?.blitzReadinessScore)
      blitzes = blitzes.filter((b) => canSeeBlitz(score, b))
    }

    // Knockable (post-filter) address depth per blitz — the opportunity size.
    const counts = blitzes.length
      ? await db.doorKnockLead.groupBy({
          by: ["blitzId"],
          where: { blitzId: { in: blitzes.map((b) => b.id) }, suppressed: false },
          _count: { _all: true },
        })
      : []
    const knockableByBlitz = new Map(counts.map((c) => [c.blitzId, c._count._all]))

    const rows = blitzes.map((b) => {
      const claimed = b.signups.filter((s) => s.status === "CLAIMED" || s.status === "ACTIVE").length
      const waitlisted = b.signups.filter((s) => s.status === "WAITLISTED").length
      const mine = b.signups.find((s) => s.repId === repId)
      return {
        id: b.id,
        name: b.name,
        market: b.market.name,
        carrier: b.market.carrier.name,
        startDate: b.startDate,
        endDate: b.endDate,
        repCap: b.repCap,
        knockable: knockableByBlitz.get(b.id) ?? 0,
        claimed,
        waitlisted,
        spotsLeft: Math.max(0, b.repCap - claimed),
        manager: b.manager.name ?? b.manager.email,
        mySignup: mine ? { status: mine.status, waitPosition: mine.waitPosition } : null,
      }
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[GET /api/blitz-board]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
