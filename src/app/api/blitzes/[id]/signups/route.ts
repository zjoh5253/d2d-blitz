import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Manager roster for a blitz's job-board signups. CLAIMED reps need territory,
// ACTIVE reps are live, WAITLISTED reps are queued. Admin / FIELD_MANAGER only.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id } = await params

    const [blitz, signups] = await Promise.all([
      db.blitz.findUnique({ where: { id }, select: { openForSignup: true, boardNotifiedAt: true } }),
      db.blitzSignup.findMany({
        where: { blitzId: id, status: { in: ["CLAIMED", "ACTIVE", "WAITLISTED"] } },
        include: { rep: { select: { id: true, name: true, email: true } } },
        orderBy: [{ status: "asc" }, { waitPosition: "asc" }, { claimedAt: "asc" }],
      }),
    ])
    return NextResponse.json({
      openForSignup: blitz?.openForSignup ?? false,
      boardNotifiedAt: blitz?.boardNotifiedAt ?? null,
      signups,
    })
  } catch (error) {
    console.error("[GET /api/blitzes/:id/signups]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
