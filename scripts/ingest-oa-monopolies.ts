import * as fs from "node:fs"
import * as path from "node:path"
import * as readline from "node:readline"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Bulk-load full OpenAddresses data into `scanner_addresses` for every Kinetic
// carrier-monopoly ZIP, so the admin "Create blitz" flow hits the instant
// cached path with complete, filterable addresses (instead of the thin OSM
// fallback). Reads monopoly ZIPs from the shared DB's carrier_monopolies and
// the OA county CSVs from the local map-scanner data dir; writes additively.
//
// Usage (PROD): npx tsx scripts/ingest-oa-monopolies.ts --prod
//        (LOCAL): npx tsx scripts/ingest-oa-monopolies.ts --allow-local
// Optional: --states OH,TX        (limit to certain states)
//           --all-carriers        (every carrier's monopoly ZIPs, not just Kinetic)

const OA_BASE = "C:/Users/marie/Desktop/dev/map-scanner/data/oa/extracted"
const REGIONS = ["midwest", "northeast", "south", "west"]

function readProdUrl(): string {
  const env = fs.readFileSync(".env.kinetic.local", "utf8")
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "")
}

function splitCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = "", inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === "," && !inQ) { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out
}

// Find the OA state dir across region packs: <base>/<region>/us/<state-lc>
function stateDir(state: string): string | null {
  const lc = state.toLowerCase()
  for (const r of REGIONS) {
    const d = path.join(OA_BASE, r, "us", lc)
    if (fs.existsSync(d)) return d
  }
  return null
}

interface Row {
  id: string; street: string; unit: string | null; city: string; state: string
  zip: string; lat: number | null; lng: number | null; ext: string | null
}

async function main() {
  const wantProd = process.argv.includes("--prod")
  const allowLocal = process.argv.includes("--allow-local")
  const allCarriers = process.argv.includes("--all-carriers")
  const statesIdx = process.argv.indexOf("--states")
  const statesArg = statesIdx >= 0
    ? (process.argv[statesIdx + 1] ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : []

  const url = wantProd ? readProdUrl() : process.env.DATABASE_URL ?? ""
  const host = url.replace(/^[^@]*@/, "").split(/[/?]/)[0]
  const isNeon = /neon\.tech/i.test(host)
  if (wantProd && !isNeon) throw new Error(`--prod but host not Neon: ${host}`)
  if (!wantProd && !allowLocal) throw new Error("Pass --prod or --allow-local")
  console.log(`DB host: ${host}`)

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  try {
    // 1. Monopoly ZIPs (+ state) from the shared scanner table. Default to
    //    Kinetic only (historical behavior); --all-carriers covers every brand.
    const monos = await db.$queryRawUnsafe<{ zip_code: string; state: string }[]>(
      allCarriers
        ? `SELECT zip_code, state FROM carrier_monopolies`
        : `SELECT zip_code, state FROM carrier_monopolies WHERE provider_slug = 'kinetic'`
    )
    const byState = new Map<string, Set<string>>()
    for (const m of monos) {
      if (statesArg.length && !statesArg.includes(m.state.toUpperCase())) continue
      const s = m.state.toUpperCase()
      if (!byState.has(s)) byState.set(s, new Set())
      byState.get(s)!.add(m.zip_code)
    }
    const totalZips = [...byState.values()].reduce((n, s) => n + s.size, 0)
    console.log(`${allCarriers ? "All-carrier" : "Kinetic"} monopoly ZIPs: ${totalZips} across ${byState.size} states\n`)
    if (totalZips === 0) { console.log("Nothing to load."); return }

    const perZip = new Map<string, number>()
    const ensuredZips = new Set<string>()
    let inserted = 0
    const batch: Row[] = []
    const BATCH = 500

    const ensureZip = async (zip: string, state: string, city: string | null) => {
      await db.$executeRawUnsafe(
        `INSERT INTO scanner_zips (zip_code, state, city) VALUES ($1,$2,$3)
         ON CONFLICT (zip_code) DO UPDATE SET state = COALESCE(NULLIF(EXCLUDED.state,''), scanner_zips.state)`,
        zip, state, city
      )
    }
    const flush = async () => {
      if (!batch.length) return
      const tuples: string[] = []; const params: unknown[] = []
      batch.forEach((r, i) => {
        const b = i * 8
        tuples.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},'LEAD',NOW(),NOW())`)
        params.push(r.id, r.street, r.city, r.state, r.zip, r.lat, r.lng, r.ext)
      })
      inserted += await db.$executeRawUnsafe(
        `INSERT INTO scanner_addresses (id, street, city, state, zip_code, lat, lng, external_id, kind, created_at, updated_at)
         VALUES ${tuples.join(",")} ON CONFLICT (id) DO NOTHING`,
        ...params
      )
      batch.length = 0
    }

    // Process states with the fewest county files first so most monopoly ZIPs
    // load quickly; the giant packs (TX) come last.
    const ordered = [...byState.entries()]
      .map(([state, zips]) => {
        const dir = stateDir(state)
        const count = dir ? fs.readdirSync(dir).filter((f) => f.endsWith(".csv")).length : 0
        return { state, zips, dir, count }
      })
      .sort((a, b) => a.count - b.count)

    for (const { state, zips, dir } of ordered) {
      if (!dir) { console.log(`! ${state}: no local OA pack — SKIPPED (${zips.size} ZIPs use OSM fallback)`); continue }
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".csv"))
      console.log(`${state}: ${zips.size} ZIPs, scanning ${files.length} county files…`)
      for (const f of files) {
        const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, f), { encoding: "utf8" }), crlfDelay: Infinity })
        let col: Record<string, number> | null = null
        for await (const line of rl) {
          if (!line) continue
          const cells = splitCsvRow(line)
          if (!col) { col = {}; cells.forEach((c, i) => (col![c.toUpperCase().trim()] = i))
            if (col.NUMBER === undefined || col.STREET === undefined || col.POSTCODE === undefined) break
            continue }
          const zip = (cells[col.POSTCODE] ?? "").trim().padStart(5, "0").slice(0, 5)
          if (!zips.has(zip)) continue
          const num = (cells[col.NUMBER] ?? "").trim(); const street = (cells[col.STREET] ?? "").trim()
          if (!num || !street) continue
          const lat = col.LAT >= 0 ? parseFloat(cells[col.LAT]) : NaN
          const lng = col.LON >= 0 ? parseFloat(cells[col.LON]) : NaN
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
          const hash = col.HASH >= 0 ? (cells[col.HASH] ?? "").trim() : ""
          const city = (col.CITY >= 0 ? (cells[col.CITY] ?? "").trim() : "").toUpperCase()
          const id = `oa_${hash || `${zip}_${num}_${street}`.replace(/\s+/g, "_")}`.slice(0, 200)
          if (!ensuredZips.has(zip)) { await ensureZip(zip, state, city || null); ensuredZips.add(zip) }
          batch.push({ id, street: `${num} ${street}`.toUpperCase(), unit: null, city, state, zip, lat, lng, ext: hash || null })
          perZip.set(zip, (perZip.get(zip) ?? 0) + 1)
          if (batch.length >= BATCH) await flush()
        }
        rl.close()
      }
      await flush()
      console.log(`  ${state} done — running total inserted ${inserted}`)
    }
    await flush()

    console.log(`\n=== Loaded ${inserted} addresses for ${perZip.size}/${totalZips} monopoly ZIPs ===`)
    const empty = [...byState.values()].flatMap((s) => [...s]).filter((z) => !perZip.has(z))
    if (empty.length) console.log(`ZIPs with no OA rows (will use OSM fallback): ${empty.length}`)
  } finally {
    await db.$disconnect()
  }
}
main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1) })
