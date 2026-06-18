import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { applyCustomerSuppression, keyFromParts } from "@/lib/leads/customer-suppression"

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
  const blitz = await db.blitz.findUnique({
    where: { id },
    select: {
      id: true,
      market: { select: { carrier: { select: { name: true } } } },
    },
  })
  if (!blitz) {
    return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
  }

  const suppression = await applyCustomerSuppression({ blitzId: id })
  const [total, visible] = await Promise.all([
    db.doorKnockLead.count({ where: { blitzId: id } }),
    db.doorKnockLead.count({
      where: { blitzId: id, disposition: "PENDING", suppressed: false },
    }),
  ])

  const uncached = await db.doorKnockLead.findMany({
    where: { blitzId: id, disposition: "PENDING", suppressed: false },
    select: { streetNumber: true, streetName: true, zip: true },
  })
  const keys = uncached
    .map((lead) => keyFromParts(lead.streetNumber, lead.streetName, lead.zip))
    .filter((key): key is string => Boolean(key))
  const cached = await db.kineticAddressStatus.count({
    where: { addressKey: { in: keys } },
  })

  const kinetic = blitz.market.carrier.name.toLowerCase().includes("kinetic")
  return NextResponse.json({
    blitzId: id,
    total,
    suppressed: total - visible,
    visible,
    cached,
    pendingProviderChecks: kinetic ? Math.max(0, keys.length - cached) : 0,
    providerScanRequired: kinetic && keys.length > cached,
    suppression,
  })
}
