import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { z } from "zod"

const MANAGER_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"]

const createSchema = z.object({
  blitzId: z.string().min(1, "Blitz is required"),
  address: z.string().min(1, "Address is required"),
  outcome: z.enum([
    "NO_ANSWER",
    "NOT_INTERESTED",
    "CALLBACK",
    "PITCHED",
    "SOLD",
    "DO_NOT_KNOCK",
  ]),
  notes: z.string().optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timestamp: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const repIdParam = searchParams.get("repId")
    const blitzIdParam = searchParams.get("blitzId")
    const outcomeParam = searchParams.get("outcome")

    const isManager = MANAGER_ROLES.includes(session.user.role)

    // Reps can only see their own touchpoints
    const repId = isManager && repIdParam ? repIdParam : session.user.id
    if (!isManager) {
      // Force to own rep ID
    }

    const where: Record<string, unknown> = {}

    if (!isManager) {
      where.repId = session.user.id
    } else if (repIdParam) {
      where.repId = repIdParam
    }

    if (blitzIdParam) {
      where.blitzId = blitzIdParam
    }

    if (outcomeParam) {
      where.outcome = outcomeParam
    }

    const touchpoints = await db.touchpoint.findMany({
      where,
      include: {
        rep: { select: { id: true, name: true, email: true } },
        blitz: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: "desc" },
    })

    return NextResponse.json(touchpoints)
  } catch (error) {
    console.error("[GET /api/touchpoints]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { blitzId, address, outcome, notes, latitude, longitude, timestamp } =
      parsed.data

    // Verify blitz exists
    const blitz = await db.blitz.findUnique({ where: { id: blitzId } })
    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    }

    const touchpoint = await db.touchpoint.create({
      data: {
        repId: session.user.id,
        blitzId,
        address,
        outcome,
        notes: notes || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        blitz: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(touchpoint, { status: 201 })
  } catch (error) {
    console.error("[POST /api/touchpoints]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
