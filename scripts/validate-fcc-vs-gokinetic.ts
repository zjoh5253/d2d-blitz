import "dotenv/config"
import * as fs from "node:fs"
import * as readline from "node:readline"
import { latLngToCell, gridDisk } from "h3-js"
import { db } from "../src/lib/db"
import { keyFromParts } from "../src/lib/leads/customer-suppression"

// Validate the FCC serviceability prediction against the gokinetic verdicts the
// trickle has ALREADY cached (kinetic_address_status) — free ground truth, no
// new gokinetic calls. Builds a confusion matrix: where FCC (in-hex/neighbor)
// and gokinetic (serviceable/customer) agree and where they don't. The number
// that matters: of leads FCC would CULL, how many did gokinetic say are
// actually serviceable (false culls)?
//
// Usage: npx tsx scripts/validate-fcc-vs-gokinetic.ts --blitz <id> --csv <fiber.csv>

const KINETIC_PROVIDER_ID = "131413"
const FIBER_TECH = new Set(["50", "71", "72"])
const RESIDENTIAL_BRC = new Set(["R", "X"])
const H3_RES = 8

function parseArgs(argv: string[]) {
  let blitzId = "", csv = ""
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--blitz") blitzId = argv[++i]
    else if (argv[i] === "--csv") csv = argv[++i]
  }
  if (!blitzId || !csv) { console.error("usage: --blitz <id> --csv <path>"); process.exit(2) }
  return { blitzId, csv }
}

async function buildKineticCells(csvPath: string): Promise<Set<string>> {
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity })
  const cells = new Set<string>()
  let first = true
  for await (const line of rl) {
    if (first) { first = false; continue }
    if (!line) continue
    const c1 = line.indexOf(","), c2 = line.indexOf(",", line.indexOf(",") + 1)
    if (c1 < 0 || c2 < 0 || line.slice(c1 + 1, c2) !== KINETIC_PROVIDER_ID) continue
    const f = line.split(","); const n = f.length
    if (n < 12 || !FIBER_TECH.has(f[n - 8]) || !RESIDENTIAL_BRC.has(f[n - 4])) continue
    const h3 = f[n - 1].trim(); if (h3) cells.add(h3)
  }
  return cells
}

async function main() {
  const { blitzId, csv } = parseArgs(process.argv.slice(2))
  const blitz = await db.blitz.findUnique({ where: { id: blitzId }, select: { name: true } })
  if (!blitz) throw new Error(`Blitz not found: ${blitzId}`)
  console.log(`Blitz: ${blitz.name}`)

  const cells = await buildKineticCells(csv)

  // All leads with coords → map canonical key -> {lat,lng}
  const leads = await db.doorKnockLead.findMany({
    where: { blitzId, lat: { not: null }, lng: { not: null } },
    select: { streetNumber: true, streetName: true, zip: true, lat: true, lng: true },
  })
  const byKey = new Map<string, { lat: number; lng: number }>()
  for (const l of leads) {
    const k = keyFromParts(l.streetNumber, l.streetName, l.zip)
    if (k) byKey.set(k, { lat: l.lat as number, lng: l.lng as number })
  }

  // gokinetic verdicts we already have, intersected with this blitz's leads.
  const statuses = await db.kineticAddressStatus.findMany({
    where: { addressKey: { in: [...byKey.keys()] } },
    select: { addressKey: true, serviceable: true, isCustomer: true, comingSoon: true },
  })
  console.log(`Leads: ${byKey.size} | gokinetic-scanned overlap: ${statuses.length}`)
  if (statuses.length === 0) { console.log("No overlap yet — trickle hasn't cached any of this blitz's addresses. Re-run later."); return }

  // Confusion matrix.
  let fccServ_gkServ = 0, fccServ_gkNot = 0, fccCull_gkServ = 0, fccCull_gkNot = 0
  let gkComingSoon = 0
  for (const s of statuses) {
    const ll = byKey.get(s.addressKey)!
    const cell = latLngToCell(ll.lat, ll.lng, H3_RES)
    const fccServiceable = cells.has(cell) || gridDisk(cell, 1).some((c) => cells.has(c))
    const gkServiceable = s.serviceable || s.isCustomer
    if (s.comingSoon && !gkServiceable) gkComingSoon++
    if (fccServiceable && gkServiceable) fccServ_gkServ++
    else if (fccServiceable && !gkServiceable) fccServ_gkNot++
    else if (!fccServiceable && gkServiceable) fccCull_gkServ++
    else fccCull_gkNot++
  }
  const n = statuses.length
  console.log(`\n=== FCC prediction vs gokinetic truth (n=${n}) ===`)
  console.log(`  FCC serviceable & gokinetic serviceable: ${fccServ_gkServ}`)
  console.log(`  FCC serviceable & gokinetic NOT:         ${fccServ_gkNot}  (FCC over-keeps — harmless, rep just gets a dud)`)
  console.log(`  FCC CULL & gokinetic serviceable:        ${fccCull_gkServ}  <-- FALSE CULLS (the risk)`)
  console.log(`  FCC CULL & gokinetic NOT serviceable:    ${fccCull_gkNot}  (cull confirmed)`)
  console.log(`  (of the gokinetic-NOT above, ${gkComingSoon} are 'coming soon' future fiber)`)
  const culls = fccCull_gkServ + fccCull_gkNot
  if (culls > 0) console.log(`\n  Of ${culls} leads FCC would cull, ${fccCull_gkServ} were actually serviceable = ${((fccCull_gkServ / culls) * 100).toFixed(0)}% false-cull rate`)
  const agree = fccServ_gkServ + fccCull_gkNot
  console.log(`  Overall agreement: ${((agree / n) * 100).toFixed(0)}%`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
