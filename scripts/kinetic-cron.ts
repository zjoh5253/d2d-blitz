import "dotenv/config"
import { db } from "../src/lib/db"
import { runScan } from "./scan-kinetic"
import { applyCustomerSuppression } from "../src/lib/leads/customer-suppression"

// One cron tick: scan a small, throttle-safe batch of Kinetic-blitz addresses
// against gokinetic, then re-run the customer-suppression sweep so any newly
// found customers (and new in-DB installs/sales) are hidden from reps.
//
// Designed for a frequent small-batch schedule (gokinetic throttles ~10/IP).
// Resumable + idempotent — every tick advances the backfill and keeps future
// blitzes covered with zero per-blitz wiring. Run from a RESIDENTIAL IP
// (Marie's machine); a datacenter IP (Vercel/Render) gets blocked faster.
//
// Env: KINETIC_CRON_BATCH (addresses per tick, default 8).
// Usage (scheduler): tsx scripts/kinetic-cron.ts

async function main() {
  const batch = parseInt(process.env.KINETIC_CRON_BATCH ?? "8", 10) || 8
  console.log(`[kinetic-cron] tick — scanning up to ${batch} Kinetic addresses`)

  const scan = await runScan({
    limit: batch,
    kineticOnly: true,
    maxAgeDays: 30,
    minDelay: 1500,
    cooldown: 120_000,
  })

  const sup = await applyCustomerSuppression({})
  console.log(
    `[kinetic-cron] done — scanned ${scan.scanned} (${scan.customers} customers found), ` +
    `sweep suppressed ${sup.updated} lead(s). known-keys=${sup.knownCustomerKeys}`
  )
}

main()
  .catch((e) => { console.error("[kinetic-cron] failed:", e); process.exit(1) })
  .finally(() => db.$disconnect())
