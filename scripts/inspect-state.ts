import "dotenv/config"
import { db } from "../src/lib/db"

async function main() {
  const carriers = await db.carrier.findMany({
    select: { id: true, name: true, revenuePerInstall: true, status: true },
  })
  console.log("Carriers (" + carriers.length + "):")
  console.table(carriers)

  const markets = await db.market.findMany({
    select: { id: true, name: true, carrierId: true, status: true, coverageArea: true },
    orderBy: { name: "asc" },
  })
  console.log("\nMarkets (" + markets.length + "):")
  console.table(markets.slice(0, 30))
  if (markets.length > 30) console.log("...(" + (markets.length - 30) + " more)")

  const reps = await db.user.findMany({
    where: { role: "FIELD_REP" },
    select: { id: true, name: true, email: true, status: true },
  })
  console.log("\nField reps (" + reps.length + "):")
  console.table(reps)

  const blitzes = await db.blitz.findMany({
    select: { id: true, name: true, marketId: true, status: true, startDate: true, endDate: true },
    orderBy: { startDate: "desc" },
  })
  console.log("\nBlitzes (" + blitzes.length + "):")
  console.table(blitzes.slice(0, 20))

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
