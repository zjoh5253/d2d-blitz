import { db } from "@/lib/db"
import { canonicalizeAddress } from "@/lib/installs/match"

// Suppress door-knock leads whose address matches a KNOWN CURRENT CUSTOMER,
// so reps don't waste time knocking doors that already have service.
//
// v1 sources (everything we already have in our own DB):
//   - InstallRecord.customerAddress  (service installed)
//   - Sale.customerAddress           (sold, install scheduled)
//   - DoorKnockLead disposition=SOLD (sold through the app)
//
// Scale-up (later): a carrier partner export (e.g. Kinetic) becomes just
// another source feeding `gatherKnownCustomerKeys` — the matching + flagging
// below is source-agnostic.
//
// Matching is EXACT on a canonical key (canonicalized street + 5-digit ZIP)
// — high precision so we never hide a real prospect on a fuzzy guess. Reuses
// the §4 install-matcher canonicalizer ("123 Main St" == "123 Main Street",
// directionals/units normalized).

const ZIP5 = (s: string | null | undefined): string =>
  (s ?? "").replace(/\D/g, "").slice(0, 5)

// Build the canonical key for a lead from its structured parts.
export function keyFromParts(
  streetNumber: string | null,
  streetName: string | null,
  zip: string | null
): string | null {
  const street = `${streetNumber ?? ""} ${streetName ?? ""}`.trim()
  const z = ZIP5(zip)
  if (!street || z.length !== 5) return null
  const canon = canonicalizeAddress(street)
  if (!canon) return null
  // Reject street-less addresses (e.g. number-only "0", blank street name).
  // Their canonical key has no letters and would collide — every such lead
  // would match one degenerate cache/customer entry and be falsely suppressed.
  if (!/[a-z]/i.test(canon)) return null
  return `${canon}|${z}`
}

// Build the canonical key from a single free-form address string like
// "824 PARK LAKE CT NW, MONROE, GA 30656". Splits the street portion off
// the first comma and pulls the trailing 5-digit ZIP.
export function keyFromFullAddress(full: string | null): string | null {
  if (!full) return null
  const z = (full.match(/\b(\d{5})(?:-\d{4})?\b/g)?.pop()) ?? ""
  if (z.length !== 5) return null
  const street = full.split(",")[0]?.trim() ?? ""
  if (!street) return null
  const canon = canonicalizeAddress(street)
  if (!canon) return null
  if (!/[a-z]/i.test(canon)) return null // reject street-less / number-only (see keyFromParts)
  return `${canon}|${z}`
}

export type SuppressReason = string

// Gather the set of addresses that should be hidden from reps → human reason.
// Two kinds: current customers (installs/sales/sold/gokinetic/partner exports)
// and addresses Kinetic does NOT serve (gokinetic serviceable=false). Both are
// "not blitz-ready"; distinct reason strings keep them separable/reversible.
export async function gatherKnownCustomerKeys(): Promise<Map<string, SuppressReason>> {
  const keys = new Map<string, SuppressReason>()
  const add = (k: string | null, reason: SuppressReason) => {
    if (k && !keys.has(k)) keys.set(k, reason)
  }

  const [installs, sales, soldLeads, kineticCustomers, servicedAddresses, nonServiceable] = await Promise.all([
    db.installRecord.findMany({ select: { customerAddress: true } }),
    db.sale.findMany({ select: { customerAddress: true } }),
    db.doorKnockLead.findMany({
      where: { disposition: "SOLD" },
      select: { streetNumber: true, streetName: true, zip: true },
    }),
    // Addresses the Kinetic (gokinetic) scan flagged as current customers.
    // addressKey is already the canonical key, so it drops straight in.
    db.kineticAddressStatus.findMany({
      where: { isCustomer: true },
      select: { addressKey: true },
    }),
    // Authoritative partner/carrier exports (e.g. Chuzo for Kinetic, a
    // CrowdFiber export for RightFiber). addressKey is already canonical;
    // `source` tags which export it came from so reasons stay distinguishable.
    db.servicedAddress.findMany({ select: { addressKey: true, source: true } }),
    // Addresses the gokinetic scan affirmatively says Kinetic does NOT serve.
    // Not a "customer" — but equally not blitz-ready, so reps shouldn't knock
    // them. `comingSoon` (future fiber) gets a distinct reason so those can be
    // un-suppressed when the area goes live. Distinct reason strings keep these
    // separable from customer suppressions for one-query reversal.
    db.kineticAddressStatus.findMany({
      where: { serviceable: false },
      select: { addressKey: true, comingSoon: true },
    }),
  ])

  for (const r of installs) add(keyFromFullAddress(r.customerAddress), "Current customer (install on record)")
  for (const s of sales) add(keyFromFullAddress(s.customerAddress), "Current customer (sale on record)")
  for (const l of soldLeads) add(keyFromParts(l.streetNumber, l.streetName, l.zip), "Current customer (sold lead)")
  for (const k of kineticCustomers) add(k.addressKey, "Current Kinetic customer (gokinetic)")
  for (const s of servicedAddresses) add(s.addressKey, `Current customer (${s.source})`)
  // Added last so a customer/serviced match (added above) wins the reason for
  // any key that is both.
  for (const a of nonServiceable)
    add(a.addressKey, a.comingSoon ? "Kinetic coming-soon (gokinetic)" : "Not Kinetic-serviceable (gokinetic)")

  return keys
}

export interface SuppressionResult {
  knownCustomerKeys: number
  scanned: number
  matched: number
  updated: number
  dryRun: boolean
  byReason: Record<string, number>
}

// Flag every still-knockable (PENDING) lead whose address matches a known
// customer. Idempotent: re-running only touches newly-matching leads. Does
// NOT un-suppress — once flagged it stays flagged unless cleared manually.
export async function applyCustomerSuppression(
  opts: { dryRun?: boolean } = {}
): Promise<SuppressionResult> {
  const dryRun = opts.dryRun ?? false
  const known = await gatherKnownCustomerKeys()

  // Only scan unworked, not-already-suppressed leads — these are the doors a
  // rep would actually knock.
  const leads = await db.doorKnockLead.findMany({
    where: { disposition: "PENDING", suppressed: false },
    select: { id: true, streetNumber: true, streetName: true, zip: true },
  })

  const byReason: Record<string, number> = {}
  const toUpdate: { id: string; reason: string }[] = []
  for (const l of leads) {
    const k = keyFromParts(l.streetNumber, l.streetName, l.zip)
    if (!k) continue
    const reason = known.get(k)
    if (reason) {
      toUpdate.push({ id: l.id, reason })
      byReason[reason] = (byReason[reason] ?? 0) + 1
    }
  }

  let updated = 0
  if (!dryRun && toUpdate.length > 0) {
    // Group by reason so each updateMany sets the right reason string.
    const byReasonIds = new Map<string, string[]>()
    for (const u of toUpdate) {
      const arr = byReasonIds.get(u.reason) ?? []
      arr.push(u.id)
      byReasonIds.set(u.reason, arr)
    }
    const CHUNK = 1000
    for (const [reason, ids] of byReasonIds) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const res = await db.doorKnockLead.updateMany({
          where: { id: { in: ids.slice(i, i + CHUNK) } },
          data: { suppressed: true, suppressionReason: reason },
        })
        updated += res.count
      }
    }
  }

  return {
    knownCustomerKeys: known.size,
    scanned: leads.length,
    matched: toUpdate.length,
    updated,
    dryRun,
    byReason,
  }
}
