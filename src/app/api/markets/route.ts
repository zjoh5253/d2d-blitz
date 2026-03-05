import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const marketCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  carrierId: z.string().min(1, "Carrier is required"),
  ownerId: z.string().min(1, "Owner is required"),
  coverageArea: z.string().optional().or(z.literal("")),
  competitionNotes: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "PLANNING"]).default("ACTIVE"),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const markets = await db.market.findMany({
      include: {
        carrier: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { blitzes: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(markets)
  } catch (error) {
    console.error("[markets GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = marketCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, carrierId, ownerId, coverageArea, competitionNotes, status } = parsed.data

    const market = await db.market.create({
      data: {
        name,
        carrierId,
        ownerId,
        coverageArea: coverageArea || null,
        competitionNotes: competitionNotes || null,
        status,
      },
      include: {
        carrier: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(market, { status: 201 })
  } catch (error) {
    console.error("[markets POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
