import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { keyFromParts } from "@/lib/leads/customer-suppression"
import { KineticClient, KineticThrottledError } from "@/lib/kinetic/availability"

// Just-in-time "is this door worth knocking?" check for the rep app.
//
// A rep taps a pin on the map → this runs ONE address lookup for THAT door and
// tells them, before they walk up: is Kinetic sellable here, and does the
// address already look like a current Kinetic customer.
//
// Design (deliberately NOT a bulk scraper):
//   * cache-first — if we already have a recent kinetic_address_status row for
//     the canonical address, return it instantly with NO external call. The
//     gentle background trickle + prior taps keep the cache warm.
//   * on a cache miss, do a SINGLE live gokinetic check, cache it (so the next
//     suppression sweep + everyone else's taps benefit), and return it.
//   * if gokinetic throttles the request, return verdict "unknown" — the rep
//     just knocks as normal. We never retry-hammer or route around the limit.
//
// Because it's one address per genuine rep tap and cache-deduped, volume is
// bounded by real field activity. See reference_gokinetic_availability.

// Treat a cached result as good for this long before re-checking live.
const FRESH_DAYS = 30

type Verdict = "worth" | "customer" | "unserviceable" | "coming_soon" | "unknown"

function verdictFor(s: {
  serviceable: boolean
  isCustomer: boolean
  comingSoon: boolean
}): Verdict {
  if (s.isCustomer) return "customer"
  if (s.serviceable) return "worth"
  if (s.comingSoon) return "coming_soon"
  return "unserviceable"
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { leadId?: string }
    const leadId = (body.leadId ?? "").trim()
    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 })
    }

    const lead = await db.doorKnockLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        streetNumber: true,
        streetName: true,
        city: true,
        state: true,
        zip: true,
        assignedRepId: true,
      },
    })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }
    // Field reps may only check their own assigned leads; admins/managers any.
    const role = (session.user as { role?: string }).role
    const isPrivileged = role === "ADMIN" || role === "FIELD_MANAGER"
    if (!isPrivileged && lead.assignedRepId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const key = keyFromParts(lead.streetNumber, lead.streetName, lead.zip)
    if (!key) {
      // No usable street address → nothing to check.
      return NextResponse.json({ verdict: "unknown" as Verdict, reason: "no_address" })
    }

    // 1) Cache-first.
    const cutoff = new Date(Date.now() - FRESH_DAYS * 86_400_000)
    const cached = await db.kineticAddressStatus.findUnique({ where: { addressKey: key } })
    if (cached && cached.checkedAt >= cutoff) {
      return NextResponse.json({
        verdict: verdictFor(cached),
        serviceable: cached.serviceable,
        isCustomer: cached.isCustomer,
        comingSoon: cached.comingSoon,
        maxQual: cached.maxQual,
        estCompletionDt: cached.estCompletionDt,
        checkedAt: cached.checkedAt,
        cached: true,
      })
    }

    // 2) Cache miss → one live check. Snappy (no batch politeness delay); a
    //    single tap can't burst the IP. Throttle/errors degrade to "unknown".
    const client = new KineticClient({ minDelayMs: 0 })
    let s
    try {
      s = await client.check({
        addressLine1: `${lead.streetNumber} ${lead.streetName}`.trim(),
        city: lead.city,
        state: lead.state,
        postalCode: (lead.zip || "").replace(/\D/g, "").slice(0, 5),
      })
    } catch (e) {
      if (e instanceof KineticThrottledError) {
        return NextResponse.json({ verdict: "unknown" as Verdict, reason: "throttled" })
      }
      return NextResponse.json({ verdict: "unknown" as Verdict, reason: "error" })
    }

    // Cache it so the next suppression sweep + everyone else's taps benefit.
    await db.kineticAddressStatus.upsert({
      where: { addressKey: key },
      create: {
        addressKey: key,
        serviceable: s.serviceable,
        isCustomer: s.isCustomer,
        comingSoon: s.comingSoon,
        validationResult: s.validationResult,
        maxQual: s.maxQual,
        techType: s.techType,
        billingStatus: s.billingStatus,
        estCompletionDt: s.estCompletionDt,
        raw: s.raw,
      },
      update: {
        serviceable: s.serviceable,
        isCustomer: s.isCustomer,
        comingSoon: s.comingSoon,
        validationResult: s.validationResult,
        maxQual: s.maxQual,
        techType: s.techType,
        billingStatus: s.billingStatus,
        estCompletionDt: s.estCompletionDt,
        raw: s.raw,
        checkedAt: new Date(),
      },
    })

    return NextResponse.json({
      verdict: verdictFor(s),
      serviceable: s.serviceable,
      isCustomer: s.isCustomer,
      comingSoon: s.comingSoon,
      maxQual: s.maxQual,
      estCompletionDt: s.estCompletionDt,
      checkedAt: new Date(),
      cached: false,
    })
  } catch (e) {
    console.error("kinetic check error:", e)
    return NextResponse.json({ verdict: "unknown" as Verdict, reason: "error" }, { status: 200 })
  }
}
