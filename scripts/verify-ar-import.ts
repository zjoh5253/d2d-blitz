import "dotenv/config"
import { db } from "../src/lib/db"

async function main() {
  const blitzes = await db.blitz.findMany({
    where: { name: { contains: "Kinetic CrowdFiber" } },
    select: { id: true, name: true },
  })

  for (const b of blitzes) {
    const total = await db.doorKnockLead.count({ where: { blitzId: b.id } })
    const withCoords = await db.doorKnockLead.count({
      where: { blitzId: b.id, lat: { not: null }, lng: { not: null } },
    })
    const samples = await db.doorKnockLead.findMany({
      where: { blitzId: b.id },
      take: 2,
      select: {
        streetNumber: true,
        streetName: true,
        city: true,
        state: true,
        zip: true,
        lat: true,
        lng: true,
        notes: true,
        disposition: true,
        assignedRep: { select: { name: true } },
      },
    })

    console.log(`\n${b.name}`)
    console.log(`  blitzId: ${b.id}`)
    console.log(`  leads:   ${total} (${withCoords} with coords)`)
    samples.forEach((s, i) =>
      console.log(`  sample ${i + 1}: ${s.streetNumber} ${s.streetName}, ${s.city}, ${s.state} ${s.zip} (${s.lat}, ${s.lng})`)
    )
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
