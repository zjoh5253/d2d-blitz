import "dotenv/config"
import { db } from "../src/lib/db"

// Find (and optionally clear) leads on NON-Kinetic blitzes that were wrongly
// suppressed with Kinetic-specific reasons by the carrier-blind global sweep.
//
// gokinetic serviceability/customer data only says whether KINETIC serves a
// door. On a Sparklight / AT&T / Wire3 / Rightfiber blitz it is meaningless —
// a door Kinetic can't serve is still a perfectly good prospect for them.
//
//   DOTENV_CONFIG_PATH=.env.kinetic.local npx tsx -r dotenv/config scripts/audit-kinetic-suppression.ts --prod
//   ... --prod --apply     (actually clears)
//
// Clearing sets suppressed=false + suppressionReason=null. Safe: the next sweep
// re-suppresses anything that genuinely matches that blitz's own carrier data.

// EXACT strings only. A loose /kinetic/i match would also catch legitimate
// partner-export reasons like "Current customer (Kinetic Chuzo)", which are
// real customer records and must stay suppressed.
const KINETIC_ONLY_REASONS = [
  "Current Kinetic customer (gokinetic)",
  "Kinetic coming-soon (gokinetic)",
  "Not Kinetic-serviceable (gokinetic)",
  "Not Kinetic fiber-serviceable (gokinetic)",
  "Not Kinetic-serviceable (FCC BDC jun2025)",
]

async function main() {
  const wantProd = process.argv.includes("--prod")
  const allowLocal = process.argv.includes("--allow-local")
  const apply = process.argv.includes("--apply")
  const url = process.env.DATABASE_URL ?? ""
  const host = url.replace(/^[^@]*@/, "").split(/[/?]/)[0] || "(unparsed)"
  const isNeon = /neon\.tech/i.test(host)
  console.log(`DB host: ${host}`)
  if (wantProd && !isNeon) throw new Error(`--prod given but host is not Neon (${host}).`)
  if (!wantProd && isNeon) throw new Error(`Host is Neon but --prod not given.`)
  if (!wantProd && !allowLocal) throw new Error(`Pass --prod or --allow-local.`)
  console.log(`Target: ${wantProd ? "PROD (Neon)" : "LOCAL"} | mode: ${apply ? "APPLY" : "DRY-RUN"}\n`)

  const blitzes = await db.blitz.findMany({
    select: {
      id: true, name: true, status: true,
      market: { select: { name: true, carrier: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  })

  const nonKinetic = blitzes.filter(
    (b) => !(b.market?.carrier?.name ?? "").toLowerCase().includes("kinetic")
  )
  console.log(`${blitzes.length} blitzes total | ${nonKinetic.length} on non-Kinetic carriers\n`)

  let grandTotal = 0
  const hits: { id: string; name: string; carrier: string; count: number }[] = []

  for (const b of nonKinetic) {
    const bad = await db.doorKnockLead.groupBy({
      by: ["suppressionReason"],
      where: { blitzId: b.id, suppressed: true, suppressionReason: { in: KINETIC_ONLY_REASONS } },
      _count: { _all: true },
    })
    const count = bad.reduce((n, r) => n + r._count._all, 0)
    if (count === 0) continue
    const carrier = b.market?.carrier?.name?.trim() ?? "(none)"
    hits.push({ id: b.id, name: b.name, carrier, count })
    grandTotal += count
    console.log(`${b.name}  [${b.status}]  carrier=${carrier}`)
    console.log(`  ${b.id}`)
    for (const r of bad) console.log(`    ${r._count._all}  ${r.suppressionReason}`)
    const total = await db.doorKnockLead.count({ where: { blitzId: b.id } })
    const knockableNow = await db.doorKnockLead.count({ where: { blitzId: b.id, suppressed: false } })
    console.log(`    → blitz has ${total} leads, ${knockableNow} knockable now, ${knockableNow + count} after clearing\n`)
  }

  if (grandTotal === 0) {
    console.log("No wrongly-suppressed leads found on non-Kinetic blitzes.")
    return
  }

  console.log(`${"=".repeat(70)}`)
  console.log(`TOTAL wrongly suppressed: ${grandTotal} leads across ${hits.length} blitzes`)

  if (!apply) {
    console.log(`\nDRY-RUN — nothing changed. Re-run with --apply to clear.`)
    return
  }

  let cleared = 0
  for (const h of hits) {
    const res = await db.doorKnockLead.updateMany({
      where: { blitzId: h.id, suppressed: true, suppressionReason: { in: KINETIC_ONLY_REASONS } },
      data: { suppressed: false, suppressionReason: null },
    })
    cleared += res.count
    console.log(`  cleared ${res.count} on ${h.name}`)
  }
  console.log(`\nDONE — un-suppressed ${cleared} leads.`)
}

main()
  .catch((e) => { console.error("FAILED:", e); process.exit(1) })
  .finally(() => db.$disconnect())
