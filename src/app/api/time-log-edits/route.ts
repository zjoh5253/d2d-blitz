import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"

// Manager/admin view of rep time-log edit requests. Defaults to PENDING.
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isManager = session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const status = new URL(request.url).searchParams.get("status") ?? "PENDING"
  const allowed = ["PENDING", "APPROVED", "REJECTED"]
  const where = allowed.includes(status) ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {}

  const edits = await db.gpsSessionEdit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      rep: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true } },
      session: {
        select: {
          id: true, startedAt: true, endedAt: true,
          durationSeconds: true, pausedSeconds: true, knockCount: true,
          blitz: { select: { name: true } },
        },
      },
    },
  })
  return NextResponse.json(edits)
}
