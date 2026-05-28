import "dotenv/config"
import { db } from "../src/lib/db"

// Seed realistic GpsSession + Sale rows for the 5 demo reps so Demo 4 of
// the 2026-05-26 update video (rep hours + sales-per-hour visibility) has
// numbers to show on /rep home and /rep/gps/history.
//
// Without this, the Hours & sales card renders dashes because none of the
// demo reps have ever ended a real GPS session on prod.
//
// All seeded rows are deterministically ID'd (seed_demo_*) so re-running
// is a no-op and post-demo cleanup is trivial: delete WHERE id LIKE
// 'seed_demo_%'. Customer names are tagged "DEMO " to keep them visually
// distinct in any sale list.
//
// Usage (point DATABASE_URL at the prod Neon DB first):
//   tsx scripts/seed-demo-gps-data.ts

interface DemoRep {
  email: string
  blitzName: string
}

const DEMO_REPS: DemoRep[] = [
  { email: "rep1@d2dblitz.com",    blitzName: "Kensett, AR (Rightfiber CrowdFiber)" },
  { email: "rep2@d2dblitz.com",    blitzName: "Rogers, AR (Rightfiber CrowdFiber)" },
  { email: "rep3@d2dblitz.com",    blitzName: "Beebe, AR (Rightfiber CrowdFiber)" },
  { email: "rep4@d2dblitz.com",    blitzName: "Bald Knob, AR (Rightfiber CrowdFiber)" },
  { email: "deandre@d2dblitz.com", blitzName: "Lockhart, TX (AT&T) Blitz" },
]

// Two sessions per rep: yesterday late morning + this morning. Total ≈
// 5 hours over the rolling 7-day window, ~80 knocks per rep.
const SESSIONS = [
  { dayOffset: -1, startHourLocal: 10, durationSeconds: 3 * 3600 + 12 * 60, pausedSeconds: 12 * 60, knockCount: 47, routeMiles: 4.2 },
  { dayOffset:  0, startHourLocal:  9, durationSeconds: 2 * 3600 + 41 * 60, pausedSeconds:  8 * 60, knockCount: 34, routeMiles: 3.1 },
]

// Two sales per rep — placed inside the session windows so they count
// toward both the daily and weekly tiles.
const SALES = [
  { dayOffset: -1, hourLocal: 12, nameSuffix: "1" },
  { dayOffset:  0, hourLocal: 11, nameSuffix: "2" },
]

function startOfLocalDay(offsetDays: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d
}

async function main() {
  let sessionWrites = 0
  let saleWrites = 0

  for (const rep of DEMO_REPS) {
    const user = await db.user.findUnique({ where: { email: rep.email } })
    if (!user) {
      console.warn(`SKIP: rep ${rep.email} not found`)
      continue
    }

    const blitz = await db.blitz.findFirst({
      where: { name: rep.blitzName },
      include: { market: { include: { carrier: true } } },
    })
    if (!blitz) {
      console.warn(`SKIP: blitz "${rep.blitzName}" not found for ${rep.email}`)
      continue
    }

    const carrierId = blitz.market.carrier.id
    const repSlug = rep.email.split("@")[0]

    for (let i = 0; i < SESSIONS.length; i++) {
      const s = SESSIONS[i]
      const sessionId = `seed_demo_${repSlug}_session${i + 1}`
      const startedAt = startOfLocalDay(s.dayOffset)
      startedAt.setHours(s.startHourLocal, 0, 0, 0)
      const endedAt = new Date(startedAt.getTime() + (s.durationSeconds + s.pausedSeconds) * 1000)

      await db.gpsSession.upsert({
        where: { id: sessionId },
        update: {},
        create: {
          id: sessionId,
          repId: user.id,
          blitzId: blitz.id,
          startedAt,
          endedAt,
          durationSeconds: s.durationSeconds,
          pausedSeconds: s.pausedSeconds,
          knockCount: s.knockCount,
          routeMiles: s.routeMiles,
        },
      })
      sessionWrites++
    }

    for (let i = 0; i < SALES.length; i++) {
      const s = SALES[i]
      const saleId = `seed_demo_${repSlug}_sale${i + 1}`
      const submittedAt = startOfLocalDay(s.dayOffset)
      submittedAt.setHours(s.hourLocal, 30, 0, 0)
      const installDate = new Date(submittedAt)
      installDate.setDate(installDate.getDate() + 7)

      await db.sale.upsert({
        where: { id: saleId },
        update: {},
        create: {
          id: saleId,
          repId: user.id,
          blitzId: blitz.id,
          carrierId,
          customerName: `DEMO ${user.name ?? repSlug} ${s.nameSuffix}`,
          customerPhone: "555-0100",
          customerAddress: "123 Demo St",
          installDate,
          submittedAt,
        },
      })
      saleWrites++
    }

    console.log(`✓ ${rep.email}: ${SESSIONS.length} sessions, ${SALES.length} sales`)
  }

  console.log(`\nDone. Sessions touched: ${sessionWrites}, sales touched: ${saleWrites}.`)
  console.log("Cleanup later: DELETE FROM gps_sessions WHERE id LIKE 'seed_demo_%'; DELETE FROM sales WHERE id LIKE 'seed_demo_%';")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
