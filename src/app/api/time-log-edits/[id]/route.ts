import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { z } from "zod"

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().optional(),
})

// Manager approves or rejects a pending time-log edit. Approving applies the
// proposed values to the GpsSession and recomputes durationSeconds; the edit
// row is kept either way as the audit trail.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(request)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isManager = session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const edit = await db.gpsSessionEdit.findUnique({ where: { id }, include: { session: true } })
  if (!edit) return NextResponse.json({ error: "Edit not found" }, { status: 404 })
  if (edit.status !== "PENDING") {
    return NextResponse.json({ error: "This edit was already reviewed" }, { status: 409 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 })
  }
  const { action, reviewNote } = parsed.data
  const review = { reviewedById: session.user.id, reviewedAt: new Date(), reviewNote: reviewNote || null }

  if (action === "reject") {
    await db.gpsSessionEdit.update({ where: { id }, data: { status: "REJECTED", ...review } })
    return NextResponse.json({ ok: true, status: "REJECTED" })
  }

  // Approve → apply to the session, recompute net duration.
  const s = edit.session
  const newStart = edit.proposedStartedAt ?? s.startedAt
  const newEnd = edit.proposedEndedAt ?? s.endedAt
  const newPaused = edit.proposedPausedSeconds ?? s.pausedSeconds
  const newKnocks = edit.proposedKnockCount ?? s.knockCount
  const durationSeconds = Math.max(0, Math.floor((newEnd.getTime() - newStart.getTime()) / 1000) - newPaused)

  await db.$transaction([
    db.gpsSession.update({
      where: { id: s.id },
      data: { startedAt: newStart, endedAt: newEnd, pausedSeconds: newPaused, knockCount: newKnocks, durationSeconds },
    }),
    db.gpsSessionEdit.update({ where: { id }, data: { status: "APPROVED", ...review } }),
  ])
  return NextResponse.json({ ok: true, status: "APPROVED", durationSeconds })
}
