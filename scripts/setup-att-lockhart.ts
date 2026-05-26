import "dotenv/config"
import { db } from "../src/lib/db"
import bcrypt from "bcryptjs"

// Sets up the infrastructure for Teki's Lockhart, TX (AT&T) blitz:
//   - AT&T carrier ($400 placeholder revenuePerInstall, override later)
//   - Lockhart, TX Market under AT&T
//   - Deandre FIELD_REP user (placeholder email — swap when known)
//
// Does NOT create the blitz or lead list yet — that's the next step
// (bootstrap-lockhart-blitz.ts).
//
// Idempotent: each resource is upserted by natural key.

const AT_T_NAME = "AT&T"
const AT_T_REVENUE_PLACEHOLDER = 400
const LOCKHART_MARKET_NAME = "Lockhart, TX (AT&T)"
const DEANDRE_EMAIL = "deandre@d2dblitz.com"
const DEANDRE_NAME = "Deandre"
const DEANDRE_PASSWORD = "password123"

async function main() {
  let carrier = await db.carrier.findFirst({ where: { name: AT_T_NAME } })
  if (!carrier) {
    carrier = await db.carrier.create({
      data: {
        name: AT_T_NAME,
        revenuePerInstall: AT_T_REVENUE_PLACEHOLDER,
        status: "ACTIVE",
      },
    })
    console.log(`CREATED carrier ${AT_T_NAME} ($${AT_T_REVENUE_PLACEHOLDER}/install) — ${carrier.id}`)
  } else {
    console.log(`EXISTS  carrier ${AT_T_NAME} — ${carrier.id}`)
  }

  // Market needs an owner. Pick any ADMIN — swap to a real market_owner
  // role user later if Teki has one.
  const owner = await db.user.findFirst({ where: { role: "ADMIN" } })
  if (!owner) throw new Error("No ADMIN user available to own the market")

  let market = await db.market.findFirst({ where: { name: LOCKHART_MARKET_NAME } })
  if (!market) {
    market = await db.market.create({
      data: {
        name: LOCKHART_MARKET_NAME,
        carrierId: carrier.id,
        ownerId: owner.id,
        coverageArea: "Lockhart, Caldwell County, TX (ZIPs 78644, 78656, 78953)",
        status: "ACTIVE",
      },
    })
    console.log(`CREATED market ${LOCKHART_MARKET_NAME} — ${market.id}`)
  } else {
    console.log(`EXISTS  market ${LOCKHART_MARKET_NAME} — ${market.id}`)
  }

  let deandre = await db.user.findUnique({ where: { email: DEANDRE_EMAIL } })
  if (!deandre) {
    const hash = await bcrypt.hash(DEANDRE_PASSWORD, 10)
    deandre = await db.user.create({
      data: {
        email: DEANDRE_EMAIL,
        name: DEANDRE_NAME,
        passwordHash: hash,
        role: "FIELD_REP",
        status: "ACTIVE",
      },
    })
    console.log(`CREATED rep ${DEANDRE_NAME} (${DEANDRE_EMAIL}) — ${deandre.id}`)
    console.log(`  password: ${DEANDRE_PASSWORD}`)
  } else {
    console.log(`EXISTS  rep ${DEANDRE_NAME} (${DEANDRE_EMAIL}) — ${deandre.id}`)
  }

  console.log("\nSummary:")
  console.log(`  carrier:  ${carrier.id}  (${AT_T_NAME})`)
  console.log(`  market:   ${market.id}   (${LOCKHART_MARKET_NAME})`)
  console.log(`  rep:      ${deandre.id}  (${DEANDRE_NAME} / ${DEANDRE_EMAIL})`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
