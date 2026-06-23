import "dotenv/config"
import * as fs from "node:fs"
import * as readline from "node:readline"
import { db } from "../src/lib/db"

// Bulk-load OpenAddresses county CSV rows into `scanner_addresses`
// (kind=LEAD) for a set of target ZIPs, so the new "Create Blitz from ZIP"
// flow (src/lib/blitz-area.ts) finds REAL, fully-addressed inventory.
//
// Why this exists: scanner_addresses is the only table the create-blitz UI
// reads from, but it's map-scanner-owned and the OH Kinetic ZIPs were never
// run through map-scanner's ingest. OSM on-demand returns thin, mostly
// street-less data that the gokinetic customer filter can't check, so for
// OA-covered areas we load the full county data here instead.
//
// Matches the existing table convention (street = "NUMBER STREET", uppercased;
// kind = LEAD). Idempotent: ON CONFLICT (id) DO NOTHING.
//
// Usage:
//   tsx scripts/ingest-oa-scanner.ts --zip 44087 --csv <summit.csv> \
//                                    --zip 44202 --csv <portage.csv> --allow-local
//   tsx scripts/ingest-oa-scanner.ts --zip 44087,44202 --csv a.csv --csv b.csv --prod
//
// Each --csv is scanned for ALL --zip targets, so the order of pairs doesn't
// matter. Pass --prod (asserts Neon host) or --allow-local (dev DB).

const DEFAULTS = {
  summit: "C:/Users/marie/Desktop/dev/map-scanner/data/oa/extracted/midwest/us/oh/summit.csv",
  portage: "C:/Users/marie/Desktop/dev/map-scanner/data/oa/extracted/midwest/us/oh/portage.csv",
}

type Args = { zips: Set<string>; csvs: string[] }

function parseArgs(argv: string[]): Args {
  const zips = new Set<string>()
  const csvs: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--zip") argv[++i].split(",").forEach((z) => zips.add(z.trim()))
    else if (a === "--csv") csvs.push(argv[++i])
  }
  // Convenience default: load the two OH Kinetic demo ZIPs.
  if (zips.size === 0 && csvs.length === 0) {
    zips.add("44087").add("44202")
    csvs.push(DEFAULTS.summit, DEFAULTS.portage)
  }
  if (zips.size === 0 || csvs.length === 0) {
    console.error("usage: tsx scripts/ingest-oa-scanner.ts --zip <zip[,zip]> --csv <path> [--csv <path>] (--prod|--allow-local)")
    process.exit(2)
  }
  return { zips, csvs }
}

function assertHost() {
  const wantProd = process.argv.includes("--prod")
  const allowLocal = process.argv.includes("--allow-local")
  const url = process.env.DATABASE_URL ?? ""
  const host = url.replace(/^[^@]*@/, "").split(/[/?]/)[0] || "(unparsed)"
  const isNeon = /neon\.tech/i.test(host)
  console.log(`DB host: ${host}`)
  if (wantProd && !isNeon) throw new Error(`--prod given but host is not Neon (${host}). Aborting.`)
  if (!wantProd && isNeon) throw new Error(`Host is Neon (prod) but --prod not given. Re-run with --prod.`)
  if (!wantProd && !allowLocal) throw new Error(`Pass --prod (Neon) or --allow-local (dev).`)
}

// Quote-aware CSV split (OA street names occasionally contain commas).
function splitCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (c === "," && !inQ) { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out
}

interface Row {
  id: string
  street: string
  unit: string | null
  city: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
  ext: string | null
}

// scanner_addresses.zip_code has an FK to scanner_zips(zip_code), so the
// parent ZIP row must exist first. Idempotent.
async function ensureZipParent(zip: string, state: string, city: string): Promise<void> {
  await db.$executeRawUnsafe(
    `INSERT INTO scanner_zips (zip_code, state, city)
     VALUES ($1, $2, $3)
     ON CONFLICT (zip_code) DO UPDATE
       SET state = COALESCE(NULLIF(EXCLUDED.state, ''), scanner_zips.state),
           city  = COALESCE(scanner_zips.city, EXCLUDED.city)`,
    zip, state || "", city || null
  )
}

// OA REGION is unreliable (summit.csv ships it blank), so prefer the state
// encoded in the file path: .../us/<state>/<county>.csv
function stateFromPath(p: string): string {
  return (p.match(/[\\/]us[\\/]([a-z]{2})[\\/]/i)?.[1] ?? "").toUpperCase()
}

// Bulk INSERT one batch via a single multi-row VALUES statement. kind is set
// as the literal 'LEAD' (unknown-typed literal → coerced to the enum by PG).
async function flush(rows: Row[]): Promise<number> {
  if (rows.length === 0) return 0
  const cols = 9
  const tuples: string[] = []
  const params: unknown[] = []
  rows.forEach((r, i) => {
    const b = i * cols
    tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},'LEAD',NOW(),NOW())`)
    params.push(r.id, r.street, r.unit, r.city, r.state, r.zip, r.lat, r.lng, r.ext)
  })
  const sql = `
    INSERT INTO scanner_addresses
      (id, street, unit, city, state, zip_code, lat, lng, external_id, kind, created_at, updated_at)
    VALUES ${tuples.join(",")}
    ON CONFLICT (id) DO UPDATE SET
      street = EXCLUDED.street,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      updated_at = NOW()`
  return db.$executeRawUnsafe(sql, ...params)
}

async function main() {
  assertHost()
  const { zips, csvs } = parseArgs(process.argv.slice(2))
  console.log(`Target ZIPs: ${[...zips].join(", ")}`)
  console.log(`CSV files:   ${csvs.length}\n`)

  const perZip = new Map<string, number>()
  const ensuredZips = new Set<string>()
  let inserted = 0
  const batch: Row[] = []
  const BATCH = 500

  for (const csv of csvs) {
    if (!fs.existsSync(csv)) throw new Error(`CSV not found: ${csv}`)
    const fileState = stateFromPath(csv)
    console.log(`Scanning ${csv} ... (state=${fileState || "?"})`)
    const rl = readline.createInterface({
      input: fs.createReadStream(csv, { encoding: "utf8" }),
      crlfDelay: Infinity,
    })
    let col: Record<string, number> | null = null
    for await (const line of rl) {
      if (!line) continue
      const cells = splitCsvRow(line)
      if (!col) {
        col = {}
        cells.forEach((c, i) => (col![c.toUpperCase().trim()] = i))
        if (col.NUMBER === undefined || col.STREET === undefined || col.POSTCODE === undefined) {
          console.log("  (no NUMBER/STREET/POSTCODE header — skipping file)")
          break
        }
        continue
      }
      const zip = (cells[col.POSTCODE] ?? "").trim().padStart(5, "0").slice(0, 5)
      if (!zips.has(zip)) continue
      const num = (cells[col.NUMBER] ?? "").trim()
      const street = (cells[col.STREET] ?? "").trim()
      if (!num || !street) continue
      const hash = col.HASH >= 0 ? (cells[col.HASH] ?? "").trim() : ""
      const lat = col.LAT >= 0 ? parseFloat(cells[col.LAT]) : NaN
      const lng = col.LON >= 0 ? parseFloat(cells[col.LON]) : NaN
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const unit = col.UNIT >= 0 ? (cells[col.UNIT] ?? "").trim() || null : null
      const city = (col.CITY >= 0 ? (cells[col.CITY] ?? "").trim() : "").toUpperCase()
      const rowRegion = (col.REGION >= 0 ? (cells[col.REGION] ?? "").trim() : "").toUpperCase()
      const state = rowRegion || fileState
      const id = `oa_${hash || `${zip}_${num}_${street}`.replace(/\s+/g, "_")}`.slice(0, 200)

      // Ensure the FK parent (scanner_zips) before any address for this ZIP.
      if (!ensuredZips.has(zip)) {
        await ensureZipParent(zip, state, city)
        ensuredZips.add(zip)
      }

      batch.push({
        id,
        street: `${num} ${street}`.toUpperCase(),
        unit,
        city,
        state,
        zip,
        lat,
        lng,
        ext: hash || null,
      })
      perZip.set(zip, (perZip.get(zip) ?? 0) + 1)
      if (batch.length >= BATCH) {
        inserted += await flush(batch)
        batch.length = 0
        process.stdout.write(`\r  inserted ${inserted}`)
      }
    }
    rl.close()
    if (batch.length > 0) { inserted += await flush(batch); batch.length = 0 }
    process.stdout.write(`\r  inserted ${inserted}\n`)
  }

  console.log("\n=== Summary (rows matched per ZIP) ===")
  for (const [z, n] of [...perZip.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${z}: ${n.toLocaleString()}`)
  }
  // Report the post-ingest table count per ZIP (covers re-runs / dedup).
  for (const z of zips) {
    const r = await db.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT COUNT(*)::bigint c FROM scanner_addresses WHERE zip_code = $1`, z
    )
    console.log(`  scanner_addresses now holds ${r[0].c.toString()} rows for ${z}`)
  }
}

main()
  .catch((e) => { console.error("INGEST FAILED:", e); process.exit(1) })
  .finally(() => db.$disconnect())
