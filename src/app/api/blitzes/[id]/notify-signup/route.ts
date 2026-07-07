import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getWebPush } from "@/lib/push"

// Manager broadcasts "this blitz is open — claim a spot" to reps via web-push.
// EXPLICIT only (a button press) — opening a blitz for signup never auto-sends,
// so test blitzes don't spam anyone. Reaches reps who've enabled notifications.
// Admin / FIELD_MANAGER only. Mirrors the go-back reminder send path.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id } = await params

    const blitz = await db.blitz.findUnique({ where: { id }, select: { id: true, name: true, openForSignup: true } })
    if (!blitz) return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    if (!blitz.openForSignup) {
      return NextResponse.json({ error: "This blitz isn't open for signup yet." }, { status: 400 })
    }

    const wp = getWebPush()
    if (!wp) return NextResponse.json({ error: "Push notifications aren't configured (VAPID keys missing)." }, { status: 503 })

    const subs = await db.pushSubscription.findMany({
      where: { rep: { role: "FIELD_REP" } },
      select: { id: true, repId: true, endpoint: true, p256dh: true, auth: true },
    })

    const payload = JSON.stringify({
      title: "New blitz open",
      body: `${blitz.name} — claim a spot on the board`,
      url: "/rep/board",
      tag: `blitz-signup-${blitz.id}`,
    })

    let sent = 0, failed = 0, stale = 0
    for (const s of subs) {
      try {
        await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (e: unknown) {
        failed++
        const code = (e as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
          stale++
        }
      }
    }

    await db.blitz.update({ where: { id }, data: { boardNotifiedAt: new Date() } })

    const reps = new Set(subs.map((s) => s.repId)).size
    return NextResponse.json({ ok: true, reps, sent, failed, stale })
  } catch (error) {
    console.error("[POST /api/blitzes/:id/notify-signup]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
