import "dotenv/config"
import { db } from "../src/lib/db"
import { getAddressProvider } from "../src/lib/address-source"
import { generateUploadBatchId } from "../src/lib/lead-import"

// Discover residential addresses for one or more ZIPs and ingest them
// as door_knock_leads on a target blitz. Future-proof replacement for
// the per-county OpenAddresses bootstrap pattern (which has gaps —
// Walton County GA was the case that prompted this).
//
// Usage:
//   tsx scripts/import-from-source.ts --blitz "Monroe GA Dawgz" --zip 30655,30656
//   tsx scripts/import-from-source.ts --blitz-id <cuid> --zip 30655
//
// Idempotent in spirit: relies on externalId in `notes` to dedup across
// re-runs (each OSM building has a stable id).

type Args = { blitzName?: string; blitzId?: string; zips: string[] }

function parseArgs(argv: string[]): Args {
  const out: Args = { zips: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--blitz") out.blitzName = argv[++i]
    else if (a === "--blitz-id") out.blitzId = argv[++i]
    else if (a === "--zip") out.zips = argv[++i].split(",").map((z) => z.trim())
  }
  if ((!out.blitzName && !out.blitzId) || out.zips.length === 0) {
    console.error("usage: tsx scripts/import-from-source.ts --blitz <name>|--blitz-id <id> --zip 30655[,30656,...]")
    process.exit(2)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const admin = await db.user.findFirst({ where: { role: "ADMIN" } })
  if (!admin) throw new Error("No ADMIN user found")

  const blitz = args.blitzId
    ? await db.blitz.findUnique({ where: { id: args.blitzId } })
    : await db.blitz.findFirst({ where: { name: args.blitzName! } })
  if (!blitz) throw new Error(`Blitz not found: ${args.blitzName ?? args.blitzId}`)

  const provider = await getAddressProvider()
  console.log(`Provider: ${provider.name}`)
  console.log(`Target blitz: ${blitz.name} (${blitz.id})`)
  console.log(`ZIPs: ${args.zips.join(", ")}\n`)

  // Two dedup paths against existing leads on this blitz:
  //  1. ID dedup — same OSM externalId already imported (re-run safety)
  //  2. Spatial dedup — a lead (any source) within 30m of an OSM pin is
  //     almost certainly the same property. Catches the case of adding
  //     OSM fill on top of a carrier-curated XLSX (Lockhart pattern).
  const SPATIAL_DEDUP_METERS = 30
  const existingLeads = await db.doorKnockLead.findMany({
    where: { blitzId: blitz.id },
    select: { lat: true, lng: true, notes: true },
  })
  const seenIds = new Set<string>()
  const spatialKeys = new Set<string>() // quantized lat/lng grid for fast lookup
  // ~111,000 m per degree of lat; longitude shrinks with cos(lat) but we
  // bucket conservatively (use lat scale for both → buckets slightly
  // bigger in longitude, which over-dedups in absolute terms but the
  // 9-cell neighbor check below covers the slack).
  const CELL_DEGREES = SPATIAL_DEDUP_METERS / 111_000
  function cellKey(lat: number, lng: number): string {
    return `${Math.floor(lat / CELL_DEGREES)}|${Math.floor(lng / CELL_DEGREES)}`
  }
  for (const r of existingLeads) {
    const m = r.notes?.match(/osm-(?:node|way|relation)-\d+/)
    if (m) seenIds.add(m[0])
    if (r.lat != null && r.lng != null) spatialKeys.add(cellKey(r.lat, r.lng))
  }
  if (seenIds.size > 0) console.log(`ID dedup: ${seenIds.size} OSM-sourced leads already on this blitz`)
  if (spatialKeys.size > 0) console.log(`Spatial dedup: ${spatialKeys.size} existing pin cells; OSM pins within ~${SPATIAL_DEDUP_METERS}m will be skipped`)

  function isSpatialDup(lat: number, lng: number): boolean {
    // Check the cell + 8 neighbors to handle pins near a cell boundary.
    const blat = Math.floor(lat / CELL_DEGREES)
    const blng = Math.floor(lng / CELL_DEGREES)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (spatialKeys.has(`${blat + dy}|${blng + dx}`)) return true
      }
    }
    return false
  }

  let totalInserted = 0
  const batchId = generateUploadBatchId()

  for (const zip of args.zips) {
    console.log(`\n--- ZIP ${zip} ---`)
    const discovered = await provider.discoverAddressesForZip(zip)
    console.log(`Discovered ${discovered.length} usable addresses`)

    let idSkips = 0
    let spatialSkips = 0
    const fresh = discovered.filter((a) => {
      if (a.externalId && seenIds.has(a.externalId)) {
        idSkips++
        return false
      }
      if (isSpatialDup(a.lat, a.lng)) {
        spatialSkips++
        return false
      }
      return true
    })
    if (idSkips > 0) console.log(`  ${idSkips} OSM IDs already on blitz — skipped`)
    if (spatialSkips > 0) console.log(`  ${spatialSkips} OSM pins within ${SPATIAL_DEDUP_METERS}m of existing leads — skipped`)

    const leads = fresh.map((a) => {
      // For pins without resolved street info, label by coords so reps
      // see something useful when tapping the pin. Rep app's on-tap
      // reverse-geocode (existing flow) fills in the real address later.
      const fallbackStreet = `Pin @ ${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`
      return {
        firstName: null,
        lastName: null,
        streetNumber: a.streetNumber ?? "",
        streetName: a.streetName ?? fallbackStreet,
        city: a.city ?? "",
        state: a.state ?? "",
        zip: a.zip || zip,
        lat: a.lat,
        lng: a.lng,
        notes: `Source: ${provider.name} — ${a.externalId ?? "no-id"}`,
        disposition: "PENDING" as const,
        uploadedById: admin.id,
        uploadBatchId: batchId,
        blitzId: blitz.id,
      }
    })

    const CHUNK = 1000
    let inserted = 0
    for (let i = 0; i < leads.length; i += CHUNK) {
      const slice = leads.slice(i, i + CHUNK)
      const res = await db.doorKnockLead.createMany({ data: slice })
      inserted += res.count
    }
    totalInserted += inserted
    console.log(`Inserted ${inserted} leads for ZIP ${zip}`)
    // Update both dedup indexes so subsequent ZIPs in this run see them.
    for (const a of fresh) {
      if (a.externalId) seenIds.add(a.externalId)
      spatialKeys.add(cellKey(a.lat, a.lng))
    }
  }

  console.log(`\nDone. Total leads inserted: ${totalInserted} on ${blitz.name}`)
  console.log(`Batch id: ${batchId}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
