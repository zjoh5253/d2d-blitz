import "dotenv/config"
import * as fs from "node:fs"
import * as readline from "node:readline"
import { latLngToCell, gridDisk } from "h3-js"
import { db } from "../src/lib/db"

// READ-ONLY analysis: how many of a blitz's door-knock leads fall in an H3
// res-8 cell where Kinetic (FCC provider_id 131413) reports residential FIBER
// service. FCC BDC availability is keyed to census block + H3 res-8 hex — NOT
// the exact address — so this is a coverage-area proxy, not a per-door truth:
//   * "no Kinetic anywhere in this hex (or its neighbors)" => almost certainly
//      unserviceable => safe to cull.
//   * "Kinetic present in the hex" => probably serviceable (verify edge cases
//      via the gokinetic trickle).
// No DB writes. Tagging is a separate step once we like the numbers.
//
// Usage:
//   npx tsx scripts/fcc-serviceability-report.ts --blitz <id> --csv <fiber.csv path>

const KINETIC_PROVIDER_ID = "131413" // Windstream/Kinetic (Uniti) — all entities
const FIBER_TECH = new Set(["50", "71", "72"])
const RESIDENTIAL_BRC = new Set(["R", "X"]) // R=residential, X=both (skip B=business-only)
const H3_RES = 8
const CULL_REASON = "Not Kinetic-serviceable (FCC BDC jun2025)"

function parseArgs(argv: string[]) {
  let blitzId = "", csv = ""
  let apply = false, wantProd = false, allowLocal = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--blitz") blitzId = argv[++i]
    else if (argv[i] === "--csv") csv = argv[++i]
    else if (argv[i] === "--apply") apply = true
    else if (argv[i] === "--prod") wantProd = true
    else if (argv[i] === "--allow-local") allowLocal = true
  }
  if (!blitzId || !csv) {
    console.error("usage: tsx scripts/fcc-serviceability-report.ts --blitz <id> --csv <path> [--apply --prod]")
    process.exit(2)
  }
  return { blitzId, csv, apply, wantProd, allowLocal }
}

async function buildKineticCells(csvPath: string): Promise<Set<string>> {
  if (!fs.existsSync(csvPath)) throw new Error(`FCC file not found: ${csvPath}`)
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity })
  const cells = new Set<string>()
  let total = 0, kinetic = 0, kept = 0, anomalies = 0, first = true
  for await (const line of rl) {
    if (first) { first = false; continue } // header
    if (!line) continue
    total++
    // cheap provider_id (col 2) check before any heavier work — numeric ids, no commas
    const c1 = line.indexOf(",")
    const c2 = line.indexOf(",", c1 + 1)
    if (c1 < 0 || c2 < 0) continue
    if (line.slice(c1 + 1, c2) !== KINETIC_PROVIDER_ID) continue
    kinetic++
    // brand_name (col 3) is quoted and can contain commas (e.g. "Valor
    // Telecommunications of Texas, LP"), inflating the front of the split. But
    // the LAST 9 columns are always comma-clean, so index from the right:
    // [...location_id, technology, maxDown, maxUp, lowLatency, brc, state, block_geoid, h3]
    const f = line.split(",")
    if (f.length < 12) { anomalies++; continue }
    const n = f.length
    const tech = f[n - 8], brc = f[n - 4], h3 = f[n - 1].trim()
    if (!FIBER_TECH.has(tech) || !RESIDENTIAL_BRC.has(brc) || !h3) continue
    cells.add(h3)
    kept++
  }
  console.log(`FCC: ${total} fiber rows scanned | ${kinetic} Kinetic(131413) | ${kept} residential-fiber kept | ${anomalies} anomalies`)
  console.log(`Distinct Kinetic residential-fiber H3 res-8 cells: ${cells.size}`)
  return cells
}

async function main() {
  const { blitzId, csv, apply, wantProd, allowLocal } = parseArgs(process.argv.slice(2))
  const url = process.env.DATABASE_URL ?? ""
  const host = url.replace(/^[^@]*@/, "").split(/[/?]/)[0] || "(unparsed)"
  const isNeon = /neon\.tech/i.test(host)
  console.log(`DB host: ${host}${apply ? "  (APPLY mode — will write)" : "  (report only)"}`)
  if (apply) {
    if (wantProd && !isNeon) throw new Error(`--prod given but host is not Neon (${host}). Aborting.`)
    if (!wantProd && isNeon) throw new Error(`Host is Neon (prod) but --prod not given. Re-run with --prod.`)
    if (!wantProd && !allowLocal) throw new Error(`--apply needs --prod (Neon) or --allow-local (dev).`)
  }

  const blitz = await db.blitz.findUnique({ where: { id: blitzId }, select: { name: true } })
  if (!blitz) throw new Error(`Blitz not found: ${blitzId}`)
  console.log(`Blitz: ${blitz.name} (${blitzId})`)

  const cells = await buildKineticCells(csv)

  const leads = await db.doorKnockLead.findMany({
    where: { blitzId, lat: { not: null }, lng: { not: null } },
    select: { id: true, lat: true, lng: true, disposition: true, suppressed: true },
  })
  const totalLeads = await db.doorKnockLead.count({ where: { blitzId } })

  let exact = 0, neighbor = 0, none = 0
  const cullEligible: string[] = [] // none-bucket leads that are still knockable
  for (const l of leads) {
    const cell = latLngToCell(l.lat as number, l.lng as number, H3_RES)
    if (cells.has(cell)) { exact++; continue }
    // cell + 6 neighbors (k=1) — conservative: only cull if Kinetic is absent
    // from the lead's hex AND every adjacent hex (avoids false-culling doors
    // near a coverage boundary).
    const ring = gridDisk(cell, 1)
    if (ring.some((c) => cells.has(c))) { neighbor++; continue }
    none++
    // Only cull leads a rep would actually knock — leave worked/already-
    // suppressed (e.g. current-customer) leads untouched.
    if (l.disposition === "PENDING" && !l.suppressed) cullEligible.push(l.id)
  }
  const withCoords = leads.length
  const serviceable = exact + neighbor
  const pct = (n: number) => `${((n / withCoords) * 100).toFixed(1)}%`
  console.log(`\nLeads: ${totalLeads} total | ${withCoords} with coords`)
  console.log(`  IN Kinetic hex (exact):        ${exact}  ${pct(exact)}`)
  console.log(`  in neighbor hex only (k=1):    ${neighbor}  ${pct(neighbor)}`)
  console.log(`  => serviceable (exact+neighbor): ${serviceable}  ${pct(serviceable)}`)
  console.log(`  NO Kinetic in hex or neighbors:  ${none}  ${pct(none)}  <-- cull candidates`)
  console.log(`  cull-eligible (PENDING, not already suppressed): ${cullEligible.length}`)

  if (!apply) {
    console.log(`\n(report only — re-run with --apply --prod to suppress the ${cullEligible.length} cull-eligible leads)`)
    return
  }

  const CHUNK = 1000
  let updated = 0
  for (let i = 0; i < cullEligible.length; i += CHUNK) {
    const res = await db.doorKnockLead.updateMany({
      where: { id: { in: cullEligible.slice(i, i + CHUNK) } },
      data: { suppressed: true, suppressionReason: CULL_REASON },
    })
    updated += res.count
    process.stdout.write(`\r  suppressed ${updated}/${cullEligible.length}`)
  }
  process.stdout.write("\n")
  console.log(`APPLIED — ${updated} leads suppressed as "${CULL_REASON}" (reversible: clear by suppressionReason)`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
