import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { reflowWaitlist } from "@/lib/blitz-signups"

// Rep claims / withdraws a job-board spot.
//
// Concurrency: both handlers lock the blitz row (SELECT ... FOR UPDATE) inside
// the transaction so concurrent claims can't both grab the last spot, and
// waitlist promotion/renumbering stays consistent. CLAIMED if under repCap,
// else WAITLISTED. Withdraw frees a spot and promotes the next waitlister.

type LockedBlitz = { id: string; rep_cap: number; open_for_signup: boolean; status: string }

export async function POST(request: NextRequest, { params }: { params: Promise<{ blitzId: string }> }) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "FIELD_REP") {
      return NextResponse.json({ error: "Only field reps can claim a blitz" }, { status: 403 })
    }
    const repId = session.user.id
    const { blitzId } = await params

    const result = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<LockedBlitz[]>`
        SELECT id, rep_cap, open_for_signup, status FROM blitzes WHERE id = ${blitzId} FOR UPDATE`
      const b = locked[0]
      if (!b) return { code: 404 as const }
      if (!b.open_for_signup || b.status === "CLOSED" || b.status === "REVIEW") {
        return { code: 400 as const, msg: "This blitz isn't open for signup." }
      }

      const existing = await tx.blitzSignup.findUnique({ where: { blitzId_repId: { blitzId, repId } } })
      if (existing && (existing.status === "CLAIMED" || existing.status === "WAITLISTED" || existing.status === "ACTIVE")) {
        return { code: 200 as const, signup: existing } // idempotent
      }

      const claimed = await tx.blitzSignup.count({ where: { blitzId, status: { in: ["CLAIMED", "ACTIVE"] } } })
      let status: "CLAIMED" | "WAITLISTED" = "CLAIMED"
      let waitPosition: number | null = null
      if (claimed >= b.rep_cap) {
        status = "WAITLISTED"
        waitPosition = (await tx.blitzSignup.count({ where: { blitzId, status: "WAITLISTED" } })) + 1
      }

      const signup = existing
        ? await tx.blitzSignup.update({
            where: { id: existing.id },
            data: { status, waitPosition, claimedAt: new Date(), activatedAt: null, decidedAt: null, decidedById: null },
          })
        : await tx.blitzSignup.create({ data: { blitzId, repId, status, waitPosition } })
      return { code: 200 as const, signup }
    })

    if (result.code === 404) return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    if (result.code === 400) return NextResponse.json({ error: result.msg }, { status: 400 })
    return NextResponse.json(result.signup)
  } catch (error) {
    console.error("[POST /api/blitz-board/:id/claim]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ blitzId: string }> }) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const repId = session.user.id
    const { blitzId } = await params

    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM blitzes WHERE id = ${blitzId} FOR UPDATE`
      const s = await tx.blitzSignup.findUnique({ where: { blitzId_repId: { blitzId, repId } } })
      if (!s || s.status === "WITHDRAWN" || s.status === "DECLINED") return { code: 400 as const, msg: "You haven't claimed this blitz." }
      if (s.status === "ACTIVE") return { code: 400 as const, msg: "You're already assigned — ask your manager to remove you." }

      const wasClaimed = s.status === "CLAIMED"
      const wasPos = s.waitPosition
      await tx.blitzSignup.update({ where: { id: s.id }, data: { status: "WITHDRAWN", waitPosition: null } })
      await reflowWaitlist(tx, blitzId, { freedSpot: wasClaimed, removedWaitPosition: wasPos })
      return { code: 200 as const }
    })

    if (result.code === 400) return NextResponse.json({ error: result.msg }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/blitz-board/:id/claim]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
