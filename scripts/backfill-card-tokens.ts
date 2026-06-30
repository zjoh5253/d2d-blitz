// Fiber Blitz OS v2 — backfill public_card_token for blitzes created before the
// card existed. Idempotent: only touches blitzes with a null token. Does NOT
// flip public_card_enabled (managers opt blitzes in deliberately).
//
// Local: `npx tsx -r dotenv/config scripts/backfill-card-tokens.ts`

import { db } from "../src/lib/db";
import { generateCardToken } from "../src/lib/public-card";

async function main() {
  const missing = await db.blitz.findMany({ where: { publicCardToken: null }, select: { id: true } });
  for (const b of missing) {
    await db.blitz.update({ where: { id: b.id }, data: { publicCardToken: generateCardToken() } });
  }
  console.log(`Backfilled ${missing.length} card token(s).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
