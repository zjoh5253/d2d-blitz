import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import type { DoorKnockDisposition } from "@prisma/client"
import { z } from "zod"
import { parseQuery, optionalId, DoorKnockDispositionSchema } from "@/lib/validate"

const VALID_DISPOSITIONS: DoorKnockDisposition[] = [
  "PENDING",
  "NOT_HOME",
  "GO_BACK",
  "SOLD",
  "NOT_INTERESTED",
]

const doorKnockLeadsQuerySchema = z.object({
  assignedRepId: optionalId,
  disposition: DoorKnockDispositionSchema.optional(),
  blitzId: optionalId,
  uploadBatchId: optionalId,
  unassigned: z.string().optional(),
  assigned: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = parseQuery(searchParams, doorKnockLeadsQuerySchema)

    if (!parsed.success) {
      return parsed.response
    }

    const { assignedRepId, disposition, blitzId, uploadBatchId, unassigned, assigned } = parsed.data

    const where: Record<string, unknown> = {}

    // Field reps only see their own leads
    if (session.user.role === "FIELD_REP") {
      where.assignedRepId = session.user.id
    } else if (assignedRepId) {
      where.assignedRepId = assignedRepId
    }

    if (unassigned === "true") {
      where.assignedRepId = null
    } else if (assigned === "true") {
      where.assignedRepId = { not: null }
    }

    if (disposition) {
      where.disposition = disposition
    }

    if (blitzId) {
      where.blitzId = blitzId
    }

    if (uploadBatchId) {
      where.uploadBatchId = uploadBatchId
    }

    const leads = await db.doorKnockLead.findMany({
      where,
      include: {
        assignedRep: { select: { id: true, name: true } },
        blitz: { select: { id: true, name: true } },
        goBack: { select: { id: true, status: true, followUpDate: true } },
      },
      orderBy: [{ streetName: "asc" }, { streetNumber: "asc" }],
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error("[GET /api/door-knock-leads]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
