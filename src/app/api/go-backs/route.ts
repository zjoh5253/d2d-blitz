import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { parseISO } from "date-fns"
type GoBackStatus = "SCHEDULED" | "REVISITED" | "CONVERTED" | "CLOSED"

const goBackSchema = z.object({
  blitzId: z.string().min(1, "Blitz is required"),
  prospectName: z.string().min(1, "Prospect name is required"),
  prospectPhone: z.string().optional().or(z.literal("")),
  prospectAddress: z.string().min(1, "Address is required"),
  followUpDate: z.string().min(1, "Follow-up date is required"),
  notes: z.string().optional().or(z.literal("")),
})

const validStatuses: GoBackStatus[] = [
  "SCHEDULED",
  "REVISITED",
  "CONVERTED",
  "CLOSED",
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const repIdParam = searchParams.get("repId")
    const statusParam = searchParams.get("status") as GoBackStatus | null

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    const repId =
      isManager && repIdParam ? repIdParam : session.user.id

    const where: Record<string, unknown> = { repId }

    if (statusParam && validStatuses.includes(statusParam)) {
      where.status = statusParam
    }

    const gobacks = await db.goBack.findMany({
      where,
      include: {
        blitz: true,
        rep: { select: { id: true, name: true } },
      },
      orderBy: { followUpDate: "asc" },
    })

    return NextResponse.json(gobacks)
  } catch (error) {
    console.error("[GET /api/go-backs]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = goBackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      blitzId,
      prospectName,
      prospectPhone,
      prospectAddress,
      followUpDate,
      notes,
    } = parsed.data

    const repId = session.user.id

    // Verify the rep is assigned to the blitz
    const assignment = await db.blitzAssignment.findFirst({
      where: { repId, blitzId },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "You are not assigned to this blitz." },
        { status: 403 }
      )
    }

    const goback = await db.goBack.create({
      data: {
        repId,
        blitzId,
        prospectName,
        prospectPhone: prospectPhone || null,
        prospectAddress,
        followUpDate: parseISO(followUpDate),
        notes: notes || null,
      },
    })

    return NextResponse.json(goback, { status: 201 })
  } catch (error) {
    console.error("[POST /api/go-backs]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
