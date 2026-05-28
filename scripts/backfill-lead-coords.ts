import "dotenv/config"
import { db } from "../src/lib/db"

// Backfill lat/lng on door_knock_leads that came in without coordinates
// (carrier XLSX exports like the Lockhart AT&T list ship street addresses
// only). Uses the US Census Geocoder — free, no API key, USPS-validated.
//
// Usage:
//   tsx scripts/backfill-lead-coords.ts --blitz "Lockhart, TX (AT&T) Blitz"
//   tsx scripts/backfill-lead-coords.ts --blitz-id <cuid>
//   tsx scripts/backfill-lead-coords.ts --all      # every lead with null lat
//
// Idempotent — only touches rows where lat IS NULL.

const GEO_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
const CONCURRENCY = 8

type Args = { blitzName?: string; blitzId?: string; all: boolean }
function parseArgs(argv: string[]): Args {
  const out: Args = { all: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--blitz") out.blitzName = argv[++i]
    else if (a === "--blitz-id") out.blitzId = argv[++i]
    else if (a === "--all") out.all = true
  }
  if (!out.blitzName && !out.blitzId && !out.all) {
    console.error("usage: tsx scripts/backfill-lead-coords.ts [--blitz <name> | --blitz-id <id> | --all]")
    process.exit(2)
  }
  return out
}

async function geocodeOne(addr: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    address: addr,
    benchmark: "Public_AR_Current",
    format: "json",
  })
  const res = await fetch(`${GEO_URL}?${params.toString()}`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    result?: { addressMatches?: Array<{ coordinates?: { x: number; y: number } }> }
  }
  const m = data.result?.addressMatches?.[0]?.coordinates
  if (!m) return null
  // Census returns x=lng, y=lat.
  return { lat: m.y, lng: m.x }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  let blitzId: string | undefined = args.blitzId
  if (args.blitzName && !blitzId) {
    const b = await db.blitz.findFirst({ where: { name: args.blitzName } })
    if (!b) throw new Error(`Blitz not found: ${args.blitzName}`)
    blitzId = b.id
  }

  const leads = await db.doorKnockLead.findMany({
    where: { lat: null, ...(blitzId ? { blitzId } : {}) },
    select: { id: true, streetNumber: true, streetName: true, city: true, state: true, zip: true },
  })

  console.log(`Found ${leads.length} leads without coords${blitzId ? ` (blitz ${blitzId})` : " (all blitzes)"}`)
  if (leads.length === 0) return

  let geocoded = 0
  let failed = 0
  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const slice = leads.slice(i, i + CONCURRENCY)
    await Promise.all(
      slice.map(async (l) => {
        const fullAddr = `${l.streetNumber} ${l.streetName}, ${l.city}, ${l.state} ${l.zip}`
        try {
          const coords = await geocodeOne(fullAddr)
          if (coords) {
            await db.doorKnockLead.update({ where: { id: l.id }, data: { lat: coords.lat, lng: coords.lng } })
            geocoded++
          } else {
            failed++
          }
        } catch (e) {
          failed++
          console.error(`  err on ${l.id}: ${(e as Error).message}`)
        }
      })
    )
    process.stdout.write(`\r  progress: ${geocoded + failed} / ${leads.length} (geocoded=${geocoded}, failed=${failed})`)
  }
  process.stdout.write("\n")
  console.log(`Done. Geocoded ${geocoded}, failed ${failed}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
