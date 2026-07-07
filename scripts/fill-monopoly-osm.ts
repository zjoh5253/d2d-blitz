import * as fs from "node:fs"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { osmOverpassProvider } from "../src/lib/providers/osm-overpass"

// Fill OSM building-footprint addresses into `scanner_addresses` for every
// carrier-monopoly ZIP that still has NO inventory after the OpenAddresses
// bulk-load — i.e. the rural ZIPs OA doesn't cover. Gives the map-scanner
// Monopolies view an address count for (nearly) every blitz, and seeds the
// instant cached path for create-blitz. Writes additively (kind=LEAD).
//
// Usage (PROD): npx tsx scripts/fill-monopoly-osm.ts --prod
//        (LOCAL): npx tsx scripts/fill-monopoly-osm.ts --allow-local
// Optional: --states GA,PA   --limit 20   --delay 2500 (ms between ZIPs)

function readProdUrl(): string {
  const env = fs.readFileSync(".env.kinetic.local", "utf8")
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "")
}
const arg = (flag: string) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const wantProd = process.argv.includes("--prod")
  const allowLocal = process.argv.includes("--allow-local")
  const states = (arg("--states") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  const limit = arg("--limit") ? parseInt(arg("--limit")!, 10) : Infinity
  const delayMs = arg("--delay") ? parseInt(arg("--delay")!, 10) : 2500

  const url = wantProd ? readProdUrl() : process.env.DATABASE_URL ?? ""
  const host = url.replace(/^[^@]*@/, "").split(/[/?]/)[0]
  if (wantProd && !/neon\.tech/i.test(host)) throw new Error(`--prod but host not Neon: ${host}`)
  if (!wantProd && !allowLocal) throw new Error("Pass --prod or --allow-local")
  console.log(`DB host: ${host}`)

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  try {
    // Monopoly ZIPs with NO LEAD inventory yet (any carrier).
    const gaps = await db.$queryRawUnsafe<{ zip_code: string; state: string; city: string | null }[]>(
      `SELECT m.zip_code, m.state, m.city FROM carrier_monopolies m
       WHERE NOT EXISTS (
         SELECT 1 FROM scanner_addresses a WHERE a.zip_code = m.zip_code AND a.kind = 'LEAD'
       )
       ${states.length ? `AND m.state = ANY($1)` : ""}
       ORDER BY m.state, m.zip_code`,
      ...(states.length ? [states] : [])
    )
    const todo = gaps.slice(0, limit)
    console.log(`Gap ZIPs to fill via OSM: ${todo.length}${todo.length < gaps.length ? ` (of ${gaps.length}, limited)` : ""}\n`)

    let filled = 0, empty = 0, failed = 0, totalInserted = 0
    for (let i = 0; i < todo.length; i++) {
      const { zip_code: zip, state, city } = todo[i]
      process.stdout.write(`[${i + 1}/${todo.length}] ${zip} ${state}: `)
      try {
        // skipReverseGeocode: count + locate by footprint; placeholders for
        // pins without OSM street tags (rep app reverse-geocodes at sale time).
        const found = await osmOverpassProvider.discoverAddressesForZip(zip, { skipReverseGeocode: true })
        const rows = found.filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
        if (!rows.length) { empty++; console.log("0 OSM buildings"); await sleep(delayMs); continue }

        await db.$executeRawUnsafe(
          `INSERT INTO scanner_zips (zip_code, state, city) VALUES ($1,$2,$3)
           ON CONFLICT (zip_code) DO UPDATE SET state = COALESCE(NULLIF(EXCLUDED.state,''), scanner_zips.state)`,
          zip, state, city
        )

        const BATCH = 500
        for (let b = 0; b < rows.length; b += BATCH) {
          const slice = rows.slice(b, b + BATCH)
          const tuples: string[] = []; const params: unknown[] = []
          slice.forEach((a, j) => {
            const off = j * 8
            const street = a.streetNumber && a.streetName
              ? `${a.streetNumber} ${a.streetName}`.toUpperCase()
              : `PIN @ ${a.lat.toFixed(6)},${a.lng.toFixed(6)}`
            const id = `${a.externalId ?? `osm_${zip}_${a.lat}_${a.lng}`}`.slice(0, 200)
            tuples.push(`($${off+1},$${off+2},$${off+3},$${off+4},$${off+5},$${off+6},$${off+7},$${off+8},'LEAD',NOW(),NOW())`)
            params.push(id, street, (a.city ?? city ?? "").toUpperCase(), state, zip, a.lat, a.lng, a.externalId ?? null)
          })
          totalInserted += await db.$executeRawUnsafe(
            `INSERT INTO scanner_addresses (id, street, city, state, zip_code, lat, lng, external_id, kind, created_at, updated_at)
             VALUES ${tuples.join(",")} ON CONFLICT (id) DO NOTHING`,
            ...params
          )
        }
        filled++
        console.log(`${rows.length} buildings inserted`)
      } catch (e) {
        failed++
        console.log(`FAILED: ${e instanceof Error ? e.message : e}`)
      }
      await sleep(delayMs) // Nominatim/Overpass etiquette
    }

    console.log(`\n=== OSM fill done: ${filled} ZIPs filled, ${empty} had 0 OSM buildings, ${failed} failed; ${totalInserted} addresses inserted ===`)
  } finally {
    await db.$disconnect()
  }
}
main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1) })
