import { db } from "@/lib/db"
import { runScan } from "@/lib/kinetic/scan"
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
    select: { id: true, market: { select: { carrier: { select: { name: true } } } } },
  })
  if (!blitz) return null
  const kinetic = blitz.market.carrier.name.toLowerCase().includes("kinetic")

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
  }
}
