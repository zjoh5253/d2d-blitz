import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string }
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 })

  await db.pushSubscription.deleteMany({ where: { endpoint, repId: session.user.id } })
  return NextResponse.json({ ok: true })
}
