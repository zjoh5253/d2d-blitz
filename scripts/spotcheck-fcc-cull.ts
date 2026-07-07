import "dotenv/config"
import * as fs from "node:fs"
import * as readline from "node:readline"
import { latLngToCell, gridDisk } from "h3-js"
import { db } from "../src/lib/db"
import { KineticClient, KineticThrottledError } from "../src/lib/kinetic/availability"

// Validate the FCC serviceability cull against GROUND TRUTH (gokinetic's live
// checker). Samples the "no Kinetic in hex or neighbors" cull candidates and
// asks gokinetic whether each is actually serviceable. Measures the false-cull
// rate so we know how much to trust the (year-old) FCC jun2025 data before
// hiding ~8k doors. READ-ONLY — does not write to the DB.
//
// Usage:
//   npx tsx scripts/spotcheck-fcc-cull.ts --blitz <id> --csv <fiber.csv> --sample 25

const KINETIC_PROVIDER_ID = "131413"
const FIBER_TECH = new Set(["50", "71", "72"])
const RESIDENTIAL_BRC = new Set(["R", "X"])
const H3_RES = 8
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function parseArgs(argv: string[]) {
  let blitzId = "", csv = "", sample = 25
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--blitz") blitzId = argv[++i]
    else if (argv[i] === "--csv") csv = argv[++i]
    else if (argv[i] === "--sample") sample = parseInt(argv[++i], 10) || sample
  }
  if (!blitzId || !csv) { console.error("usage: --blitz <id> --csv <path> [--sample N]"); process.exit(2) }
  return { blitzId, csv, sample }
}

async function buildKineticCells(csvPath: string): Promise<Set<string>> {
  if (!fs.existsSync(csvPath)) throw new Error(`FCC file not found: ${csvPath}`)
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity })
  const cells = new Set<string>()
  let first = true
  for await (const line of rl) {
    if (first) { first = false; continue }
    if (!line) continue
    const c1 = line.indexOf(","), c2 = line.indexOf(",", line.indexOf(",") + 1)
    if (c1 < 0 || c2 < 0) continue
    if (line.slice(c1 + 1, c2) !== KINETIC_PROVIDER_ID) continue
    const f = line.split(",")
    if (f.length < 12) continue
    const n = f.length
    if (!FIBER_TECH.has(f[n - 8]) || !RESIDENTIAL_BRC.has(f[n - 4])) continue
    const h3 = f[n - 1].trim()
    if (h3) cells.add(h3)
  }
  return cells
}

async function main() {
  const { blitzId, csv, sample } = parseArgs(process.argv.slice(2))
  const blitz = await db.blitz.findUnique({ where: { id: blitzId }, select: { name: true } })
  if (!blitz) throw new Error(`Blitz not found: ${blitzId}`)
  console.log(`Blitz: ${blitz.name}`)

  const cells = await buildKineticCells(csv)
  console.log(`Kinetic residential-fiber H3 cells: ${cells.size}`)

  const leads = await db.doorKnockLead.findMany({
    where: { blitzId, lat: { not: null }, lng: { not: null }, disposition: "PENDING", suppressed: false },
    select: { streetNumber: true, streetName: true, city: true, state: true, zip: true, lat: true, lng: true },
  })

  // Collect cull candidates: no Kinetic in the lead's hex or any neighbor.
  const cull: { line1: string; city: string; state: string; zip: string }[] = []
  for (const l of leads) {
    const cell = latLngToCell(l.lat as number, l.lng as number, H3_RES)
    if (cells.has(cell)) continue
    if (gridDisk(cell, 1).some((c) => cells.has(c))) continue
    cull.push({
      line1: `${l.streetNumber} ${l.streetName}`.trim(),
      city: l.city, state: l.state,
      zip: (l.zip || "").replace(/\D/g, "").slice(0, 5),
    })
  }
  console.log(`Cull candidates: ${cull.length}`)
  if (cull.length === 0) return

  // Evenly-spaced sample across the list (spreads geographically vs first-N).
  const step = Math.max(1, Math.floor(cull.length / sample))
  const picks: typeof cull = []
  for (let i = 0; i < cull.length && picks.length < sample; i += step) picks.push(cull[i])
  console.log(`Sampling ${picks.length} (every ${step}th)\n`)

  const client = new KineticClient({ minDelayMs: 1500 })
  let checked = 0, serviceable = 0, comingSoon = 0, notServ = 0, customer = 0, errors = 0, throttleStreak = 0
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i]
    try {
      const s = await client.check({ addressLine1: p.line1, city: p.city, state: p.state, postalCode: p.zip })
      checked++
      throttleStreak = 0
      const verdict = s.isCustomer ? "CUSTOMER (serviceable!)"
        : s.serviceable ? "SERVICEABLE (false cull!)"
        : s.comingSoon ? "coming-soon"
        : "not serviceable (cull OK)"
      if (s.isCustomer) customer++
      if (s.serviceable && !s.isCustomer) serviceable++
      else if (!s.serviceable && s.comingSoon) comingSoon++
      else if (!s.serviceable && !s.comingSoon) notServ++
      console.log(`  ${p.line1}, ${p.city} ${p.zip} -> ${verdict}`)
    } catch (e) {
      if (e instanceof KineticThrottledError) {
        throttleStreak++
        if (throttleStreak >= 3) { console.log(`  throttled ${throttleStreak}x — stopping (sample so far is enough).`); break }
        console.log(`  throttled — cooling 120s (streak ${throttleStreak})...`)
        await sleep(120_000); i--; continue
      }
      errors++
      console.log(`  ${p.line1}: error ${e instanceof Error ? e.message : e}`)
      if (errors >= 5) { console.log("too many errors — stopping."); break }
    }
  }

  const falseCull = serviceable + customer
  console.log(`\n=== RESULT (${checked} checked) ===`)
  console.log(`  not serviceable (cull confirmed): ${notServ}`)
  console.log(`  coming-soon (future fiber):        ${comingSoon}`)
  console.log(`  SERVICEABLE now (false cull):      ${serviceable}`)
  console.log(`  current CUSTOMER (false cull):     ${customer}`)
  if (checked > 0) {
    console.log(`\n  FCC cull agreement: ${(((notServ) / checked) * 100).toFixed(0)}% confirmed not-serviceable`)
    console.log(`  False-cull rate:    ${((falseCull / checked) * 100).toFixed(0)}% were actually serviceable/customer`)
    console.log(`  (coming-soon counts as "not sellable now" but is a future market.)`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
