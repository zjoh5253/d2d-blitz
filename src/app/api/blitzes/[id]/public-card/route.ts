import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCardToken } from "@/lib/public-card"

// Enable a blitz's public share card and mint its token if it doesn't have one.
// Idempotent: an already-enabled blitz just returns its existing token. The card
// page lives at /b/{token} (no auth) — see src/app/b/[token]. Admin / FM only.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id } = await params

    const blitz = await db.blitz.findUnique({ where: { id }, select: { id: true, publicCardToken: true, publicCardEnabled: true } })
    if (!blitz) return NextResponse.json({ error: "Blitz not found" }, { status: 404 })

    if (blitz.publicCardToken && blitz.publicCardEnabled) {
      return NextResponse.json({ token: blitz.publicCardToken, enabled: true })
    }

    // Mint a token if missing (retry once on the unlikely unique collision).
    let token = blitz.publicCardToken
    for (let attempt = 0; !token && attempt < 3; attempt++) {
      const candidate = generateCardToken()
      const clash = await db.blitz.findUnique({ where: { publicCardToken: candidate }, select: { id: true } })
      if (!clash) token = candidate
    }
    if (!token) return NextResponse.json({ error: "Couldn't mint a card token." }, { status: 500 })

    await db.blitz.update({ where: { id }, data: { publicCardEnabled: true, publicCardToken: token } })
    return NextResponse.json({ token, enabled: true })
  } catch (error) {
    console.error("[POST /api/blitzes/:id/public-card]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
