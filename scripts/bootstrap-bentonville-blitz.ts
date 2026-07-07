import "dotenv/config"
import * as fs from "node:fs"
import { db } from "../src/lib/db"
import {
  parseCSVText,
  normalizeRow,
  generateUploadBatchId,
  type NormalizedLead,
} from "../src/lib/lead-import"

// Bootstrap the 5th AR Rightfiber blitz. Teki sent
// "Bentonville CrowdFiber Leads May 18 2026.csv" 2026-05-28 — same shape
// as the other 4 CrowdFiber CSVs already wired (Kensett/Rogers/Beebe/Bald Knob),
// so we reuse the standard lead-import pipeline.
//
// Creates blitz if missing, imports leads if blitz is empty. No rep
// auto-assignment — Marie decides who runs Bentonville (single rep =
// import-from-source.ts pattern would auto-assign next time it runs).
//
// Idempotent.

const FILE = "C:/Users/marie/Downloads/Bentonville CrowdFiber Leads May 18 2026.csv"
const BLITZ_NAME = "Bentonville, AR (Rightfiber CrowdFiber)"
const MARKET_NAME = "Arkansas Rightfiber"

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } })
  if (!admin) throw new Error("No ADMIN user found")

  const market = await db.market.findFirst({ where: { name: MARKET_NAME } })
  if (!market) throw new Error(`Market not found: ${MARKET_NAME}`)

  let blitz = await db.blitz.findFirst({ where: { name: BLITZ_NAME } })
  if (!blitz) {
    blitz = await db.blitz.create({
      data: {
        marketId: market.id,
        managerId: admin.id,
        name: BLITZ_NAME,
        startDate: new Date("2026-05-26T00:00:00Z"),
        endDate: new Date("2026-06-09T00:00:00Z"),
        repCap: 1,
        status: "PLANNING",
      },
    })
    console.log(`CREATED blitz ${BLITZ_NAME} — ${blitz.id}`)
  } else {
    console.log(`EXISTS blitz ${BLITZ_NAME} — ${blitz.id}`)
  }

  const existingLeads = await db.doorKnockLead.count({ where: { blitzId: blitz.id } })
  if (existingLeads > 0) {
    console.log(`SKIP lead import — blitz already has ${existingLeads} leads`)
    return
  }

  const text = fs.readFileSync(FILE, "utf8")
  const rows = parseCSVText(text)
  console.log(`Parsed ${rows.length} rows from ${FILE}`)

  const batchId = generateUploadBatchId()
  const ctx = { uploadedById: admin.id, uploadBatchId: batchId, blitzId: blitz.id }
  const leads = rows
    .map((r) => normalizeRow(r, ctx))
    .filter((x): x is NormalizedLead => x !== null)

  if (leads.length === 0) {
    console.log("No normalized leads — nothing to insert.")
    return
  }

  const CHUNK = 1000
  let inserted = 0
  for (let i = 0; i < leads.length; i += CHUNK) {
    const slice = leads.slice(i, i + CHUNK)
    const res = await db.doorKnockLead.createMany({ data: slice })
    inserted += res.count
    process.stdout.write(`\r  inserted ${inserted}/${leads.length}`)
  }
  process.stdout.write("\n")
  console.log(`IMPORTED ${inserted} leads into ${BLITZ_NAME}`)
  console.log(`  batch:  ${batchId}`)
  console.log(`  skipped (no address / bad-address flag): ${rows.length - leads.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
