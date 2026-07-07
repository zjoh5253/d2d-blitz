// Mint a partner API key for the /api/v1 surface. The plaintext key is printed
// ONCE — copy it immediately; only its hash is stored.
//
// Local:  npx tsx -r dotenv/config scripts/mint-api-key.ts "Coastside"
// Prod:   DOTENV_CONFIG_PATH=.env.kinetic.local npx tsx -r dotenv/config scripts/mint-api-key.ts "Coastside"
// Custom scopes (default = all read scopes):
//   npx tsx -r dotenv/config scripts/mint-api-key.ts "Coastside" "installs:read,carriers:read"

import { db } from "../src/lib/db";
import { generateApiKey, API_SCOPES } from "../src/lib/api-key";

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error('Usage: mint-api-key.ts "<Partner Name>" ["scope1,scope2"]');
  const scopes = process.argv[3] ? process.argv[3].split(",").map((s) => s.trim()).filter(Boolean) : [...API_SCOPES];

  const { key, prefix, hash } = generateApiKey();
  const rec = await db.apiKey.create({ data: { name, keyPrefix: prefix, keyHash: hash, scopes } });

  console.log(`\n✅ Minted API key for "${name}"  (id ${rec.id}, prefix ${prefix}…)`);
  console.log(`   Scopes: ${scopes.join(", ")}`);
  console.log(`\n   ── KEY (shown once — copy now) ─────────────────────────────`);
  console.log(`\n   ${key}\n`);
  console.log(`   ────────────────────────────────────────────────────────────`);
  console.log(`   Give this to the partner. They call, e.g.:`);
  console.log(`   curl -H "Authorization: Bearer ${key}" https://<host>/api/v1/ping\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
