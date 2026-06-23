import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { advanceBlitzFiltering } from "@/lib/blitz-prep"

// Allow a long-ish scan batch (Vercel caps at the plan limit).
export const maxDuration = 300

function hasCronAccess(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = session?.user?.role
  const hasSessionAccess = role === "ADMIN" || role === "FIELD_MANAGER"
  if (!hasSessionAccess && !hasCronAccess(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  // batch=0 disables scanning (report-only); otherwise scan that many fresh
  // addresses through the rotating IP Royal proxy before re-suppressing.
  const url = new URL(request.url)
  const batchParam = url.searchParams.get("batch")
  const batch = batchParam === null ? undefined : Math.max(0, parseInt(batchParam, 10) || 0)

  const result = await advanceBlitzFiltering(id, batch === undefined ? {} : { batch })
  if (!result) {
    return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
  }

  const [total, visible] = await Promise.all([
    db.doorKnockLead.count({ where: { blitzId: id } }),
    db.doorKnockLead.count({
      where: { blitzId: id, disposition: "PENDING", suppressed: false },
    }),
  ])

  return NextResponse.json({
    blitzId: id,
    total,
    suppressed: total - visible,
    visible,
    cached: result.checked,
    leadPrepTotal: result.total,
    leadPrepChecked: result.checked,
    leadPrepStatus: result.leadPrepStatus,
    leadPrepSource: result.source,
    pendingProviderChecks: result.pending,
    providerScanRequired: result.kinetic && result.pending > 0,
    pulledThisCall: result.pulled,
    scannedThisCall: result.scanned,
    customersThisCall: result.customers,
  })
}
