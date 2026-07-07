import "dotenv/config"
import * as fs from "node:fs"
import { db } from "../src/lib/db"
import {
  parseXLSXBuffer,
  normalizeRow,
  generateUploadBatchId,
  type NormalizedLead,
} from "../src/lib/lead-import"

// Replace Lockhart's 7,934 OpenAddresses synth leads with the 213 real
// AT&T fiber pre-reg addresses Teki sent on 2026-05-28
// ("Copy of Lockhart New Fiber.xlsx"). The synth leads were a stopgap
// because we had no carrier-curated list; now we do.
//
// Idempotent: if a batch from this same source has already been imported,
// the new run no-ops on the import step but still removes any remaining
// OA-source leads.

const FILE = "C:/Users/marie/Downloads/Copy of Lockhart New Fiber.xlsx"
const BLITZ_NAME = "Lockhart, TX (AT&T) Blitz"
// Synth leads carry this exact prefix in their `notes` (see
// scripts/bootstrap-lockhart-blitz.ts) — use it as the surgical delete key
// so we don't touch any unrelated leads on the blitz.
const SYNTH_NOTE_PREFIX = "Source: OpenAddresses Caldwell County, TX"

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } })
  if (!admin) throw new Error("No ADMIN user found")

  const blitz = await db.blitz.findFirst({ where: { name: BLITZ_NAME } })
  if (!blitz) throw new Error(`Blitz not found: ${BLITZ_NAME}`)

  // 1. Wipe OA synth leads scoped to this blitz only.
  const toDelete = await db.doorKnockLead.count({
    where: { blitzId: blitz.id, notes: { startsWith: SYNTH_NOTE_PREFIX } },
  })
  if (toDelete > 0) {
    const del = await db.doorKnockLead.deleteMany({
      where: { blitzId: blitz.id, notes: { startsWith: SYNTH_NOTE_PREFIX } },
    })
    console.log(`Deleted ${del.count} OA synth leads from ${BLITZ_NAME}`)
  } else {
    console.log(`No OA synth leads to delete (already cleared).`)
  }

  // 2. Parse + normalize the AT&T fiber XLSX.
  const buf = fs.readFileSync(FILE)
  const rows = parseXLSXBuffer(buf)
  const batchId = generateUploadBatchId()
  const ctx = { uploadedById: admin.id, uploadBatchId: batchId, blitzId: blitz.id }
  const leads = rows
    .map((r) => normalizeRow(r, ctx))
    .filter((x): x is NormalizedLead => x !== null)
    .map((l) => ({
      ...l,
      // Prefix every imported lead's notes so they're identifiable for
      // future surgical cleanup the way the OA ones were.
      notes: ["AT&T fiber pre-reg", l.notes].filter(Boolean).join(" — "),
    }))

  console.log(`Parsed ${rows.length} rows → ${leads.length} normalized`)

  if (leads.length === 0) {
    console.log("Nothing to import.")
    return
  }

  const result = await db.doorKnockLead.createMany({ data: leads })
  console.log(`Created ${result.count} leads on ${BLITZ_NAME}`)
  console.log(`  batch: ${batchId}`)
  console.log(`  blitz: ${blitz.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
