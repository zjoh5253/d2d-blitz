import "dotenv/config"
import * as fs from "node:fs"
import { db } from "../src/lib/db"
import {
  parseXLSXBuffer,
  normalizeRow,
  generateUploadBatchId,
  type NormalizedLead,
} from "../src/lib/lead-import"

// Bulk-imports the 4 AR CrowdFiber XLSX files Teki sent on 2026-05-26
// into their respective Kinetic-Arkansas blitzes (created by
// create-ar-blitzes.ts).
//
// Re-runnable: if a batch with the same source file already imported,
// the script reports it and skips. To force a re-import, delete the
// leads with that uploadBatchId first.

const FILES: Array<{ path: string; blitzName: string }> = [
  {
    path: "C:/Users/marie/Downloads/Kensett CrowdFiber Leads May 18 2026.xlsx",
    blitzName: "Kensett, AR (Kinetic CrowdFiber)",
  },
  {
    path: "C:/Users/marie/Downloads/Rogers CrowdFiber Leads May 18 2026 (1).xlsx",
    blitzName: "Rogers, AR (Kinetic CrowdFiber)",
  },
  {
    path: "C:/Users/marie/Downloads/Beebe CrowdFiber Leads May 18 2026.xlsx",
    blitzName: "Beebe, AR (Kinetic CrowdFiber)",
  },
  {
    path: "C:/Users/marie/Downloads/Bald Knob CrowdFiber Leads May 18 2026 (1).xlsx",
    blitzName: "Bald Knob, AR (Kinetic CrowdFiber)",
  },
]

async function main() {
  // Use any admin as `uploadedById` — required by the schema. In normal
  // flow this is the signed-in admin running the upload from the UI.
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } })
  if (!admin) throw new Error("No ADMIN user found to attribute uploads to")

  for (const f of FILES) {
    const blitz = await db.blitz.findFirst({ where: { name: f.blitzName } })
    if (!blitz) {
      console.log(`SKIP ${f.blitzName} — blitz not found, run create-ar-blitzes.ts first`)
      continue
    }

    // Bail out if this blitz already has leads. Prevents accidental
    // double-import on script reruns.
    const existing = await db.doorKnockLead.count({ where: { blitzId: blitz.id } })
    if (existing > 0) {
      console.log(`SKIP ${f.blitzName} — already has ${existing} leads`)
      continue
    }

    const buf = fs.readFileSync(f.path)
    const rows = parseXLSXBuffer(buf)
    const batchId = generateUploadBatchId()
    const ctx = { uploadedById: admin.id, uploadBatchId: batchId, blitzId: blitz.id }
    const leads = rows
      .map((r) => normalizeRow(r, ctx))
      .filter((x): x is NormalizedLead => x !== null)

    if (leads.length === 0) {
      console.log(`SKIP ${f.blitzName} — file produced 0 normalized leads`)
      continue
    }

    const result = await db.doorKnockLead.createMany({ data: leads })
    const skipped = rows.length - leads.length
    console.log(`IMPORTED ${f.blitzName}`)
    console.log(`  file:    ${f.path}`)
    console.log(`  rows:    ${rows.length} (${skipped} skipped: bad-address or no street)`)
    console.log(`  created: ${result.count}`)
    console.log(`  batch:   ${batchId}`)
    console.log(`  blitz:   ${blitz.id}`)
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
