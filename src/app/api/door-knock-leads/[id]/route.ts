import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import type { DoorKnockDisposition } from "@prisma/client"
import { z } from "zod"
import { DoorKnockDispositionSchema } from "@/lib/validate"

const VALID_DISPOSITIONS: DoorKnockDisposition[] = [
  "PENDING",
  "NOT_HOME",
  "GO_BACK",
  "SOLD",
  "NOT_INTERESTED",
]

const updateLeadSchema = z.object({
  disposition: DoorKnockDispositionSchema.optional(),
  notes: z.string().nullable().optional(),
  goBackId: z.string().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const lead = await db.doorKnockLead.findUnique({
      where: { id },
      include: {
        assignedRep: { select: { id: true, name: true } },
        blitz: { select: { id: true, name: true } },
        goBack: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Field reps can only see their own leads
    if (
      session.user.role === "FIELD_REP" &&
      lead.assignedRepId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error("[GET /api/door-knock-leads/:id]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = updateLeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const lead = await db.doorKnockLead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Field reps can only update their own leads
    if (
      session.user.role === "FIELD_REP" &&
      lead.assignedRepId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data: Record<string, unknown> = {}
    const validatedBody = parsed.data

    if (validatedBody.disposition) {
      data.disposition = validatedBody.disposition
      if (validatedBody.disposition !== "PENDING") {
        data.resolvedAt = new Date()
      } else {
        data.resolvedAt = null
      }
    }

    if (validatedBody.notes !== undefined) {
      data.notes = validatedBody.notes || null
    }

    if (validatedBody.goBackId !== undefined) {
      data.goBackId = validatedBody.goBackId
    }

    const updated = await db.doorKnockLead.update({
      where: { id },
      data,
      include: {
        assignedRep: { select: { id: true, name: true } },
        blitz: { select: { id: true, name: true } },
        goBack: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PUT /api/door-knock-leads/:id]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    await db.doorKnockLead.delete({ where: { id } })

    return NextResponse.json({ message: "Lead deleted" })
  } catch (error) {
    console.error("[DELETE /api/door-knock-leads/:id]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
