import "dotenv/config"
import { db } from "../src/lib/db"
import { runScan, type ScanArgs } from "../src/lib/kinetic/scan"

// CLI wrapper around the shared scan core (src/lib/kinetic/scan.ts). Populates
// the KineticAddressStatus cache by checking PENDING-lead addresses against
// gokinetic.com. Cache-only — suppression is the suppress-known-customers sweep.
//
// Usage:
//   tsx scripts/scan-kinetic.ts --limit 25                 # scan 25 fresh addrs
//   tsx scripts/scan-kinetic.ts --blitz <id> --limit 500
//   tsx scripts/scan-kinetic.ts --limit 2000 --min-delay 500

// Re-exported so existing importers (kinetic-cron.ts, backfill-oh.ts) keep working.
export { runScan } from "../src/lib/kinetic/scan"
export type { ScanArgs, ScanResult } from "../src/lib/kinetic/scan"

function parseArgs(argv: string[]): ScanArgs {
  // gokinetic throttles a single IP hard (~10 calls then 429). Default to a
  // slow, polite cadence + a long cooldown when throttled. Resumable, so it's
  // fine to run in small chunks / via cron.
  const out: ScanArgs = { limit: 25, maxAgeDays: 30, minDelay: 1500, cooldown: 120_000, kineticOnly: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--limit") out.limit = parseInt(argv[++i], 10) || out.limit
    else if (a === "--blitz") out.blitzId = argv[++i]
    else if (a === "--max-age-days") out.maxAgeDays = parseInt(argv[++i], 10) || out.maxAgeDays
    else if (a === "--min-delay") out.minDelay = parseInt(argv[++i], 10) || out.minDelay
    else if (a === "--cooldown") out.cooldown = parseInt(argv[++i], 10) || out.cooldown
    else if (a === "--kinetic-only") out.kineticOnly = true
  }
  return out
}

// CLI entry — only when run directly (importers use runScan instead).
if (process.argv[1]?.includes("scan-kinetic")) {
  runScan(parseArgs(process.argv.slice(2)))
    .then((r) => {
      if (r && r.customers > 0) {
        console.log(`Run suppress-known-customers.ts to hide the ${r.customers} customer addresses from reps.`)
      }
    })
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
