import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { z } from "zod"
import { parseISO } from "date-fns"

type RouteParams = { params: Promise<{ id: string }> }

// A rep requests an edit to one of their own time logs. It is NOT applied here
// — it lands as a PENDING GpsSessionEdit awaiting manager approval (Teki:
// "manager approval before editing"). ISO datetime strings are TZ-aware from
// the client.
const schema = z.object({
  proposedStartedAt: z.string().optional(),
  proposedEndedAt: z.string().optional(),
  proposedPausedSeconds: z.number().int().min(0).optional(),
  proposedKnockCount: z.number().int().min(0).optional(),
  reason: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(request)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const gps = await db.gpsSession.findUnique({ where: { id } })
  if (!gps) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  if (gps.repId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data
  const hasChange =
    d.proposedStartedAt || d.proposedEndedAt ||
    d.proposedPausedSeconds != null || d.proposedKnockCount != null
  if (!hasChange) return NextResponse.json({ error: "No changes proposed" }, { status: 400 })

  // One pending edit per session at a time.
  const pending = await db.gpsSessionEdit.findFirst({ where: { sessionId: id, status: "PENDING" } })
  if (pending) return NextResponse.json({ error: "An edit is already pending review" }, { status: 409 })

  // Effective start/end after the edit must be coherent.
  const start = d.proposedStartedAt ? parseISO(d.proposedStartedAt) : gps.startedAt
  const end = d.proposedEndedAt ? parseISO(d.proposedEndedAt) : gps.endedAt
  if (end.getTime() <= start.getTime()) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 })
  }
  const paused = d.proposedPausedSeconds ?? gps.pausedSeconds
  if (paused > Math.floor((end.getTime() - start.getTime()) / 1000)) {
    return NextResponse.json({ error: "Break time can't exceed the session length" }, { status: 400 })
  }

  const created = await db.gpsSessionEdit.create({
    data: {
      sessionId: id,
      repId: session.user.id,
      proposedStartedAt: d.proposedStartedAt ? parseISO(d.proposedStartedAt) : null,
      proposedEndedAt: d.proposedEndedAt ? parseISO(d.proposedEndedAt) : null,
      proposedPausedSeconds: d.proposedPausedSeconds ?? null,
      proposedKnockCount: d.proposedKnockCount ?? null,
      reason: d.reason || null,
    },
  })
  return NextResponse.json(created, { status: 201 })
}
