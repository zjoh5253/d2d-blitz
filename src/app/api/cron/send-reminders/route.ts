import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getWebPush } from "@/lib/push"

// Scheduled push of follow-up reminders. Notifies each rep ~LEAD_MINUTES before
// a SCHEDULED go-back's follow-up time, once. Run it every ~15 min via Vercel
// Cron or an external scheduler. Gated on VAPID env (503 until set).
//
// Auth: same as the suppress cron — `Authorization: Bearer <CRON_SECRET>` or
// `?token=<CRON_SECRET>`.

export const maxDuration = 60
const LEAD_MINUTES = 30

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 })
  const auth = request.headers.get("authorization")
  const token = new URL(request.url).searchParams.get("token")
  if (auth !== `Bearer ${secret}` && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const wp = getWebPush()
  if (!wp) return NextResponse.json({ error: "VAPID keys not configured" }, { status: 503 })

  const now = new Date()
  const windowEnd = new Date(now.getTime() + LEAD_MINUTES * 60_000)
  const due = await db.goBack.findMany({
    where: { status: "SCHEDULED", reminderSentAt: null, followUpDate: { gte: now, lte: windowEnd } },
    include: { rep: { select: { pushSubscriptions: true } } },
  })

  let sent = 0, failed = 0, stale = 0
  for (const g of due) {
    const payload = JSON.stringify({
      title: "Follow-up reminder",
      body: `${g.prospectName} — ${g.prospectAddress}`,
      url: "/rep/gobacks",
      tag: `goback-${g.id}`,
    })
    for (const s of g.rep.pushSubscriptions) {
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
    // Mark processed so we don't re-notify on the next tick.
    await db.goBack.update({ where: { id: g.id }, data: { reminderSentAt: new Date() } })
  }

  return NextResponse.json({ ok: true, due: due.length, sent, failed, stale })
}
