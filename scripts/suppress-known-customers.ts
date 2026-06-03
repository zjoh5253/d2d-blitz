import "dotenv/config"
import { db } from "../src/lib/db"
import { applyCustomerSuppression } from "../src/lib/leads/customer-suppression"

// Flag PENDING door-knock leads whose address matches a known current
// customer (install / sale / sold lead) so they're hidden from reps.
//
// Usage:
//   tsx scripts/suppress-known-customers.ts --dry-run   # preview, no writes
//   tsx scripts/suppress-known-customers.ts             # apply
//
// Re-runnable. Run again after each new import / after new installs land.

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  console.log(dryRun ? "DRY RUN — no writes\n" : "APPLYING suppression\n")

  const r = await applyCustomerSuppression({ dryRun })
  console.log(`Known-customer keys: ${r.knownCustomerKeys}`)
  console.log(`PENDING leads scanned: ${r.scanned}`)
  console.log(`Matched current customers: ${r.matched}`)
  console.log(`Updated (suppressed): ${r.updated}`)
  console.log(`\nBy reason:`)
  for (const [reason, n] of Object.entries(r.byReason)) console.log(`  ${reason}: ${n}`)
  if (dryRun && r.matched > 0) console.log(`\nRe-run without --dry-run to suppress these ${r.matched} leads.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
