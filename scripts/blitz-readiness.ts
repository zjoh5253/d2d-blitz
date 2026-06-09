import "dotenv/config"
import { db } from "../src/lib/db"

// READ-ONLY: per-blitz "blitz-ready" breakdown — visible (PENDING, not
// suppressed) vs suppressed, grouped by suppression reason.
const IDS = [
  { id: "cmq6vl3qt0000p4hdr1elpufw", label: "Kerrville, TX (Kinetic)" },
  { id: "4e769d58-f5ad-4c2f-8c88-3089ececd414", label: "Harrison, AR (Kinetic)" },
]

async function main() {
  for (const b of IDS) {
    const total = await db.doorKnockLead.count({ where: { blitzId: b.id } })
    const visible = await db.doorKnockLead.count({ where: { blitzId: b.id, disposition: "PENDING", suppressed: false } })
    const suppressed = await db.doorKnockLead.groupBy({
      by: ["suppressionReason"],
      where: { blitzId: b.id, suppressed: true },
      _count: { _all: true },
    })
    console.log(`\n=== ${b.label} ===`)
    console.log(`  total: ${total}`)
    console.log(`  VISIBLE (blitz-ready, PENDING + not suppressed): ${visible}`)
    const supTotal = suppressed.reduce((s, r) => s + r._count._all, 0)
    console.log(`  suppressed: ${supTotal}`)
    for (const r of suppressed.sort((a, b) => b._count._all - a._count._all))
      console.log(`     - ${r.suppressionReason ?? "(no reason)"}: ${r._count._all}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
