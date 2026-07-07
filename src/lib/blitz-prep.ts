import { db } from "@/lib/db"
import { runScan } from "@/lib/kinetic/scan"
import { ensureInventoryForZip, importScannerInventory } from "@/lib/blitz-area"
import { applyCustomerSuppression, getProviderCheckCounts } from "@/lib/leads/customer-suppression"

// One step of a blitz's lead-filtering pipeline: scan a bounded batch of its
// addresses against gokinetic (through the rotating IP Royal proxy, fanned out),
// re-suppress current customers, then persist progress on the blitz. Flips the
// blitz to READY (unblocking staffing) once nothing is left to check.
//
// Shared by the create-page/list-view poll (POST /api/blitzes/[id]/prepare) and
// the cron backstop (GET /api/cron/suppress), so progress + completion behave
// identically whether a browser or the scheduler is driving.

export interface AdvanceResult {
  blitzId: string
  kinetic: boolean
  scanned: number
  customers: number
  total: number
  checked: number
  pending: number
  leadPrepStatus: "READY" | "FILTERING"
  // True when this call pulled addresses (vs scanned) — progress was made even
  // though scanned is 0, so the poller shouldn't treat it as a stall.
  pulled: boolean
  source: string | null
}

const DEFAULT_BATCH = 150
const DEFAULT_CONCURRENCY = 20

export async function advanceBlitzFiltering(
  blitzId: string,
  opts: { batch?: number; concurrency?: number } = {}
): Promise<AdvanceResult | null> {
  const batch = opts.batch ?? DEFAULT_BATCH
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY

  const blitz = await db.blitz.findUnique({
    where: { id: blitzId },
    select: {
      id: true, managerId: true, leadPrepZip: true, leadPrepSource: true,
      market: { select: { carrier: { select: { name: true } } } },
    },
  })
  if (!blitz) return null
  const kinetic = blitz.market.carrier.name.toLowerCase().includes("kinetic")

  // PULL PHASE: a blitz created for an un-loaded ZIP carries leadPrepZip and has
  // no leads yet. Pull its addresses first (fast OSM fallback — full data if a
  // bulk-load has since populated scanner_addresses), then later ticks filter.
  if (blitz.leadPrepZip) {
    const existingLeads = await db.doorKnockLead.count({ where: { blitzId } })
    if (existingLeads === 0) {
      let source = "osm"
      try {
        const ens = await ensureInventoryForZip(blitz.leadPrepZip, { skipReverseGeocode: true })
        source = ens.source === "cache" ? "openaddresses" : "osm"
        if (ens.addressCount > 0) {
          await importScannerInventory({ zip: blitz.leadPrepZip, blitzId, uploadedById: blitz.managerId })
        }
      } catch (error) {
        console.error("[advanceBlitzFiltering pull]", error)
      }
      const imported = await db.doorKnockLead.count({ where: { blitzId } })
      if (imported === 0) {
        // Nothing found even via OSM — terminal; stop looping so it's not stuck.
        await db.blitz.update({
          where: { id: blitzId },
          data: { leadPrepStatus: "READY", leadPrepZip: null, leadPrepSource: source, leadPrepUpdatedAt: new Date() },
        })
        return { blitzId, kinetic, scanned: 0, customers: 0, total: 0, checked: 0, pending: 0, leadPrepStatus: "READY", pulled: true, source }
      }
      await applyCustomerSuppression({ blitzId })
      const counts = await getProviderCheckCounts(blitzId)
      const pending = kinetic ? counts.pending : 0
      const status: "READY" | "FILTERING" = !kinetic || pending === 0 ? "READY" : "FILTERING"
      await db.blitz.update({
        where: { id: blitzId },
        data: {
          leadPrepStatus: status, leadPrepTotal: counts.total, leadPrepChecked: counts.checked,
          leadPrepSource: source, leadPrepZip: null, leadPrepUpdatedAt: new Date(),
        },
      })
      return { blitzId, kinetic, scanned: 0, customers: 0, total: counts.total, checked: counts.checked, pending, leadPrepStatus: status, pulled: true, source }
    }
  }

  let scanned = 0
  let customers = 0
  if (kinetic && batch > 0) {
    try {
      const scan = await runScan({
        limit: batch,
        blitzId,
        kineticOnly: false,
        maxAgeDays: 30,
        minDelay: 100,
        cooldown: 0,
        maxThrottleStreak: 12,
        concurrency,
      })
      scanned = scan?.scanned ?? 0
      customers = scan?.customers ?? 0
    } catch (error) {
      console.error("[advanceBlitzFiltering scan]", error)
    }
  }

  await applyCustomerSuppression({ blitzId })
  const counts = await getProviderCheckCounts(blitzId)
  const pending = kinetic ? counts.pending : 0
  const leadPrepStatus: "READY" | "FILTERING" = !kinetic || pending === 0 ? "READY" : "FILTERING"

  await db.blitz.update({
    where: { id: blitzId },
    data: {
      leadPrepStatus,
      leadPrepTotal: counts.total,
      leadPrepChecked: counts.checked,
      leadPrepUpdatedAt: new Date(),
      // Once filtering is done, the blitz is eligible for the rep job board.
      // Only flips true (never back to false here) so a manager can't have it
      // yanked off the board by a re-filter. Stamp the open time once (anchors
      // the premium 24h early-access window).
      ...(leadPrepStatus === "READY" ? { openForSignup: true, openedForSignupAt: new Date() } : {}),
    },
  })

  return {
    blitzId,
    kinetic,
    scanned,
    customers,
    total: counts.total,
    checked: counts.checked,
    pending,
    leadPrepStatus,
    pulled: false,
    source: blitz.leadPrepSource ?? null,
  }
}
