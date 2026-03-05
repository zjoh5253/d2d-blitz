import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const marketUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  carrierId: z.string().min(1, "Carrier is required").optional(),
  ownerId: z.string().min(1, "Owner is required").optional(),
  coverageArea: z.string().optional().or(z.literal("")),
  competitionNotes: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "PLANNING"]).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const market = await db.market.findUnique({
      where: { id },
      include: {
        carrier: true,
        owner: { select: { id: true, name: true, email: true } },
        blitzes: {
          include: {
            manager: { select: { id: true, name: true } },
            _count: { select: { assignments: true, sales: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 })
    }

    return NextResponse.json(market)
  } catch (error) {
    console.error("[markets/[id] GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = marketUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { coverageArea, competitionNotes, ...rest } = parsed.data

    const market = await db.market.update({
      where: { id },
      data: {
        ...rest,
        ...(coverageArea !== undefined && { coverageArea: coverageArea || null }),
        ...(competitionNotes !== undefined && { competitionNotes: competitionNotes || null }),
      },
      include: {
        carrier: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(market)
  } catch (error) {
    console.error("[markets/[id] PUT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    await db.market.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[markets/[id] DELETE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
