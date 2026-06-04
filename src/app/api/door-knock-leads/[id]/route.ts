import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import type { DoorKnockDisposition } from "@prisma/client"

const VALID_DISPOSITIONS: DoorKnockDisposition[] = [
  "PENDING",
  "NOT_HOME",
  "GO_BACK",
  "SOLD",
  "NOT_INTERESTED",
]

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
        events: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: { id: true, disposition: true, note: true, createdAt: true },
        },
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

    if (body.disposition && VALID_DISPOSITIONS.includes(body.disposition)) {
      data.disposition = body.disposition
      if (body.disposition !== "PENDING") {
        data.resolvedAt = new Date()
      } else {
        data.resolvedAt = null
      }
    }

    if (body.notes !== undefined) {
      data.notes = body.notes || null
    }

    if (body.goBackId !== undefined) {
      data.goBackId = body.goBackId
    }

    // Go-back scheduling: when a lead is marked GO_BACK with a follow-up
    // date/time (+ optional notes), create or update the linked GoBack so it
    // shows up in the rep's go-backs list. Requires the lead to be on a blitz.
    const gb = body.goBack as { followUpDate?: string; notes?: string } | undefined
    if (data.disposition === "GO_BACK" && gb?.followUpDate && lead.blitzId) {
      const followUpDate = new Date(gb.followUpDate)
      if (!Number.isNaN(followUpDate.getTime())) {
        const noteVal = gb.notes?.trim() ? gb.notes.trim() : null
        if (lead.goBackId) {
          await db.goBack.update({
            where: { id: lead.goBackId },
            data: { followUpDate, notes: noteVal, status: "SCHEDULED" },
          })
        } else {
          const prospectName =
            [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
            `${lead.streetNumber} ${lead.streetName}`.trim()
          const prospectAddress =
            `${lead.streetNumber} ${lead.streetName}, ${lead.city}, ${lead.state} ${lead.zip}`.trim()
          const created = await db.goBack.create({
            data: {
              repId: lead.assignedRepId ?? session.user.id,
              blitzId: lead.blitzId,
              prospectName,
              prospectAddress,
              followUpDate,
              notes: noteVal,
            },
          })
          data.goBackId = created.id
        }
        // Mirror the note onto the lead so it shows on the lead card too.
        data.notes = noteVal
      }
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

    // Record the action in the lead's history so it can be reviewed later.
    if (data.disposition) {
      await db.doorKnockLeadEvent.create({
        data: {
          leadId: id,
          disposition: data.disposition as DoorKnockDisposition,
          note: (data.notes as string | null | undefined) ?? null,
          createdById: session.user.id,
        },
      })
    }

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
