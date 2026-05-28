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

  // Pull existing externalIds for this blitz to dedup across re-runs.
  const existing = await db.doorKnockLead.findMany({
    where: { blitzId: blitz.id, notes: { contains: "osm-" } },
    select: { notes: true },
  })
  const seenIds = new Set<string>()
  for (const r of existing) {
    const m = r.notes?.match(/osm-(?:node|way|relation)-\d+/)
    if (m) seenIds.add(m[0])
  }
  if (seenIds.size > 0) console.log(`Dedup: ${seenIds.size} OSM-sourced leads already on this blitz; will skip those.`)

  let totalInserted = 0
  const batchId = generateUploadBatchId()

  for (const zip of args.zips) {
    console.log(`\n--- ZIP ${zip} ---`)
    const discovered = await provider.discoverAddressesForZip(zip)
    console.log(`Discovered ${discovered.length} usable addresses`)

    const fresh = discovered.filter((a) => !a.externalId || !seenIds.has(a.externalId))
    if (fresh.length < discovered.length) {
      console.log(`  ${discovered.length - fresh.length} already on blitz — skipped`)
    }

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
    for (const a of fresh) if (a.externalId) seenIds.add(a.externalId)
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
