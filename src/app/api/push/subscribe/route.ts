import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"

// Store (or refresh) a rep's PWA push subscription. One row per browser
// endpoint; re-subscribing updates the keys.
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sub = await request.json().catch(() => null)
  const endpoint = sub?.endpoint
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { repId: session.user.id, endpoint, p256dh, auth, userAgent: request.headers.get("user-agent") ?? undefined },
    update: { repId: session.user.id, p256dh, auth },
  })
  return NextResponse.json({ ok: true })
}
