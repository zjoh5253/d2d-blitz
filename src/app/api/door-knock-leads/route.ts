import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import type { DoorKnockDisposition, Prisma } from "@prisma/client"

const VALID_DISPOSITIONS: DoorKnockDisposition[] = [
  "PENDING",
  "NOT_HOME",
  "GO_BACK",
  "SOLD",
  "NOT_INTERESTED",
]

// Pagination cap for the opt-in `paginated=true` mode. The admin door-knock
// list can match 40k+ leads; shipping all of them as a single ~10MB payload
// (and rendering them) crashed mobile Safari. Paginated callers get a
// bounded page plus filter-scoped totals; non-paginated callers (rep app,
// territory map) keep the original bare-array behavior unchanged.
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const assignedRepId = searchParams.get("assignedRepId")
    const disposition = searchParams.get("disposition") as DoorKnockDisposition | null
    const blitzId = searchParams.get("blitzId")
    const uploadBatchId = searchParams.get("uploadBatchId")
    const unassigned = searchParams.get("unassigned")
    const assigned = searchParams.get("assigned")
    const suppressedParam = searchParams.get("suppressed")
    const paginated = searchParams.get("paginated") === "true"
    const idsOnly = searchParams.get("idsOnly") === "true"

    const where: Prisma.DoorKnockLeadWhereInput = {}

    // Field reps only see their own leads
    if (session.user.role === "FIELD_REP") {
      where.assignedRepId = session.user.id
    } else if (assignedRepId) {
      where.assignedRepId = assignedRepId
    }

    // Suppressed leads = known current customers. Reps NEVER see them (don't
    // waste time knocking doors that already have service). Admins see all by
    // default; ?suppressed=true|false lets them filter to audit.
    if (session.user.role === "FIELD_REP") {
      where.suppressed = false
    } else if (suppressedParam === "true") {
      where.suppressed = true
    } else if (suppressedParam === "false") {
      where.suppressed = false
    }

    if (unassigned === "true") {
      where.assignedRepId = null
    } else if (assigned === "true") {
      where.assignedRepId = { not: null }
    }

    if (disposition && VALID_DISPOSITIONS.includes(disposition)) {
      where.disposition = disposition
    }

    if (blitzId) {
      where.blitzId = blitzId
    }

    if (uploadBatchId) {
      where.uploadBatchId = uploadBatchId
    }

    const orderBy: Prisma.DoorKnockLeadOrderByWithRelationInput[] = [
      { streetName: "asc" },
      { streetNumber: "asc" },
    ]

    // ids-only mode: lightweight payload of just the matching lead ids,
    // used by the admin "select all N matching" action so bulk-assign can
    // still operate across the full filter without loading full objects.
    if (idsOnly) {
      const rows = await db.doorKnockLead.findMany({
        where,
        select: { id: true },
        orderBy,
      })
      return NextResponse.json(rows.map((r) => r.id))
    }

    // Paginated mode: a bounded page + filter-scoped counts so the admin
    // list's stat cards stay accurate even though only a page is returned.
    if (paginated) {
      const limitParamRaw = parseInt(searchParams.get("limit") ?? "", 10)
      const limit = Number.isFinite(limitParamRaw)
        ? Math.min(Math.max(limitParamRaw, 1), MAX_LIMIT)
        : DEFAULT_LIMIT
      const offsetRaw = parseInt(searchParams.get("offset") ?? "", 10)
      const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

      const [leads, dispositionGroups, assignmentGroups, suppressionGroups] = await Promise.all([
        db.doorKnockLead.findMany({
          where,
          include: {
            assignedRep: { select: { id: true, name: true } },
            blitz: { select: { id: true, name: true } },
            goBack: { select: { id: true, status: true, followUpDate: true } },
          },
          orderBy,
          take: limit,
          skip: offset,
        }),
        // Counts respect the exact `where` (no key-override pitfalls) by
        // grouping rather than re-counting with mutated filters.
        db.doorKnockLead.groupBy({
          by: ["disposition"],
          where,
          _count: { _all: true },
        }),
        db.doorKnockLead.groupBy({
          by: ["assignedRepId"],
          where,
          _count: { _all: true },
        }),
        db.doorKnockLead.groupBy({
          by: ["suppressed"],
          where,
          _count: { _all: true },
        }),
      ])

      const total = dispositionGroups.reduce((s, g) => s + g._count._all, 0)
      const pending =
        dispositionGroups.find((g) => g.disposition === "PENDING")?._count._all ?? 0
      const assignedCount = assignmentGroups
        .filter((g) => g.assignedRepId !== null)
        .reduce((s, g) => s + g._count._all, 0)
      const suppressedCount = suppressionGroups
        .filter((g) => g.suppressed === true)
        .reduce((s, g) => s + g._count._all, 0)

      return NextResponse.json({
        leads,
        total,
        counts: {
          total,
          pending,
          assigned: assignedCount,
          resolved: total - pending,
          suppressed: suppressedCount,
        },
        limit,
        offset,
      })
    }

    // Default (legacy) mode: bare array of every matching lead. Preserved
    // for the rep app and territory map, which need the full set.
    const leads = await db.doorKnockLead.findMany({
      where,
      include: {
        assignedRep: { select: { id: true, name: true } },
        blitz: { select: { id: true, name: true } },
        goBack: { select: { id: true, status: true, followUpDate: true } },
      },
      orderBy,
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
