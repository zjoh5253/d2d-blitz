import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const blitzCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  marketId: z.string().min(1, "Market is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  repCap: z.coerce.number().int().positive("Rep cap must be a positive integer"),
  housingPlan: z.string().optional().or(z.literal("")),
  managerId: z.string().min(1, "Manager is required"),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const blitzes = await db.blitz.findMany({
      where: status && status !== "ALL" ? { status: status as never } : undefined,
      include: {
        market: {
          include: { carrier: true },
        },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { assignments: true, sales: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(blitzes)
  } catch (error) {
    console.error("[blitzes GET]", error)
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
    const parsed = blitzCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, marketId, startDate, endDate, repCap, housingPlan, managerId } = parsed.data

    const blitz = await db.blitz.create({
      data: {
        name,
        marketId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        repCap,
        housingPlan: housingPlan || null,
        managerId,
        status: "PLANNING",
      },
      include: {
        market: { include: { carrier: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(blitz, { status: 201 })
  } catch (error) {
    console.error("[blitzes POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
