import "dotenv/config"
import * as fs from "node:fs"
import { db } from "../src/lib/db"
import { parseCSVText, generateUploadBatchId } from "../src/lib/lead-import"

// Creates the Lockhart, TX (AT&T) blitz and seeds it with door-knock
// leads sourced from the OpenAddresses Caldwell County, TX dump.
// Filter is POSTCODE=78644 (Lockhart proper) which has ~7,934 addresses.
//
// Prereq: scripts/setup-att-lockhart.ts has been run (AT&T carrier,
// Lockhart market, Deandre rep all exist).
//
// Idempotent: if the blitz already exists, leads are not re-inserted.

const OA_FILE = "C:/Users/marie/Desktop/dev/map-scanner/data/oa/extracted/south/us/tx/caldwell.csv"
const LOCKHART_ZIP = "78644"
const MARKET_NAME = "Lockhart, TX (AT&T)"
const DEANDRE_EMAIL = "deandre@d2dblitz.com"
const BLITZ_NAME = "Lockhart, TX (AT&T) Blitz"

async function main() {
  const market = await db.market.findFirst({ where: { name: MARKET_NAME } })
  if (!market) throw new Error(`Market not found: ${MARKET_NAME} — run setup-att-lockhart.ts first`)

  const deandre = await db.user.findUnique({ where: { email: DEANDRE_EMAIL } })
  if (!deandre) throw new Error(`Rep not found: ${DEANDRE_EMAIL} — run setup-att-lockhart.ts first`)

  const manager = await db.user.findFirst({ where: { role: "ADMIN" } })
  if (!manager) throw new Error("No ADMIN user to manage the blitz")

  let blitz = await db.blitz.findFirst({ where: { name: BLITZ_NAME } })
  if (!blitz) {
    blitz = await db.blitz.create({
      data: {
        marketId: market.id,
        managerId: manager.id,
        name: BLITZ_NAME,
        startDate: new Date("2026-05-26T00:00:00Z"),
        endDate: new Date("2026-06-09T00:00:00Z"),
        repCap: 1,
        status: "PLANNING",
      },
    })
    await db.blitzAssignment.create({
      data: { blitzId: blitz.id, repId: deandre.id, status: "ASSIGNED" },
    })
    console.log(`CREATED blitz ${BLITZ_NAME} — ${blitz.id}`)
    console.log(`  rep: Deandre (${deandre.id})`)
  } else {
    console.log(`EXISTS  blitz ${BLITZ_NAME} — ${blitz.id}`)
  }

  const existingLeads = await db.doorKnockLead.count({ where: { blitzId: blitz.id } })
  if (existingLeads > 0) {
    console.log(`SKIP lead import — blitz already has ${existingLeads} leads`)
    await db.$disconnect()
    return
  }

  console.log(`Reading ${OA_FILE}...`)
  const text = fs.readFileSync(OA_FILE, "utf8")
  const rows = parseCSVText(text)
  console.log(`  total rows: ${rows.length}`)

  // OA columns are lowercased by parseCSVText. Filter to Lockhart ZIP
  // and rows with valid lat/lng + number + street.
  const batchId = generateUploadBatchId()
  const leads = rows
    .filter((r) => String(r.postcode || "").trim() === LOCKHART_ZIP)
    .map((r) => {
      const lat = Number(r.lat)
      const lng = Number(r.lon)
      const num = String(r.number || "").trim()
      const street = String(r.street || "").trim()
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      if (!num && !street) return null
      const unit = String(r.unit || "").trim()
      return {
        firstName: null,
        lastName: null,
        streetNumber: num,
        // OA addresses are uppercased — title-case for display.
        streetName: titleCase(street) + (unit ? ` ${unit}` : ""),
        city: "Lockhart",
        state: "TX",
        zip: LOCKHART_ZIP,
        lat,
        lng,
        notes: "Source: OpenAddresses Caldwell County, TX (cold lead — no fiber-interest signal)",
        disposition: "PENDING" as const,
        uploadedById: manager.id,
        uploadBatchId: batchId,
        blitzId: blitz.id,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  console.log(`  filtered to ${LOCKHART_ZIP}: ${leads.length}`)

  // createMany has a parameter limit on some Postgres drivers; chunk
  // generously to stay well under it.
  const CHUNK = 1000
  let inserted = 0
  for (let i = 0; i < leads.length; i += CHUNK) {
    const slice = leads.slice(i, i + CHUNK)
    const res = await db.doorKnockLead.createMany({ data: slice })
    inserted += res.count
    process.stdout.write(`\r  inserted: ${inserted}/${leads.length}`)
  }
  process.stdout.write("\n")
  console.log(`DONE: ${inserted} leads created for blitz ${blitz.id}`)
  console.log(`  batch: ${batchId}`)

  await db.$disconnect()
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
