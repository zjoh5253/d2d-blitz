import "dotenv/config"
import { db } from "../src/lib/db"

// Creates 4 PLANNING-status blitzes under Arkansas Rightfiber for the
// CrowdFiber lead lists Teki sent (Kensett, Rogers, Beebe, Bald Knob).
// One demo rep assigned per blitz: Eve→Kensett, Frank→Rogers,
// Grace→Beebe, Henry→Bald Knob. Ivy is held for the upcoming
// Lockhart, TX (AT&T) blitz.
//
// Idempotent: if a blitz with the same name already exists under the
// Arkansas Rightfiber market, it's skipped.

const AR_MARKET_NAME = "Arkansas Rightfiber"

const CITIES = [
  { city: "Kensett",   repEmail: "rep1@d2dblitz.com", repCapHint: 1 }, // Eve
  { city: "Rogers",    repEmail: "rep2@d2dblitz.com", repCapHint: 1 }, // Frank
  { city: "Beebe",     repEmail: "rep3@d2dblitz.com", repCapHint: 1 }, // Grace
  { city: "Bald Knob", repEmail: "rep4@d2dblitz.com", repCapHint: 1 }, // Henry
]

async function main() {
  const market = await db.market.findFirst({ where: { name: AR_MARKET_NAME } })
  if (!market) throw new Error(`Market not found: ${AR_MARKET_NAME}`)

  // Pick any ADMIN user to be the blitz manager — required by the
  // schema. In a real Teki workflow he'd swap this to whoever runs the
  // AR campaign.
  const manager = await db.user.findFirst({ where: { role: "ADMIN" } })
  if (!manager) throw new Error("No ADMIN user found to manage blitzes")

  const start = new Date("2026-05-26T00:00:00Z")
  const end = new Date("2026-06-09T00:00:00Z")

  for (const c of CITIES) {
    const name = `${c.city}, AR (Rightfiber CrowdFiber)`
    const existing = await db.blitz.findFirst({
      where: { marketId: market.id, name },
    })
    if (existing) {
      console.log(`SKIP ${name} — already exists (${existing.id})`)
      continue
    }

    const rep = await db.user.findUnique({ where: { email: c.repEmail } })
    if (!rep) {
      console.log(`SKIP ${name} — rep ${c.repEmail} not found`)
      continue
    }

    const blitz = await db.blitz.create({
      data: {
        marketId: market.id,
        managerId: manager.id,
        name,
        startDate: start,
        endDate: end,
        repCap: c.repCapHint,
        status: "PLANNING",
      },
    })

    await db.blitzAssignment.create({
      data: { blitzId: blitz.id, repId: rep.id, status: "ASSIGNED" },
    })

    console.log(`CREATED ${name}`)
    console.log(`  blitzId: ${blitz.id}`)
    console.log(`  rep:     ${rep.name} (${rep.email})`)
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
