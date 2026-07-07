// Pure-logic validation for install-report matching. No API key or DB needed
// — exercises the canonicalization + scoring that replaces the old brittle
// exact-string matcher. Run: npx tsx scripts/test-install-matching.ts

import {
  canonicalizeAddress,
  canonicalizeName,
  scoreMatch,
  bestMatch,
} from "../src/lib/installs/match";
import { parseLooseDate } from "../src/lib/installs/ingest";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

console.log("\nAddress canonicalization (the old matcher failed these):");
check(
  '"123 Main Street" === "123 Main St"',
  canonicalizeAddress("123 Main Street") === canonicalizeAddress("123 Main St")
);
check(
  '"456 W Oak Ave" === "456 West Oak Avenue"',
  canonicalizeAddress("456 W Oak Ave") === canonicalizeAddress("456 West Oak Avenue")
);
check(
  'unit markers normalize: "123 Main St Apt 4" === "123 Main St #4"',
  canonicalizeAddress("123 Main St Apt 4") === canonicalizeAddress("123 Main St #4")
);

console.log("\nName canonicalization (carriers flip name order):");
check('"John Smith" === "Smith, John"', canonicalizeName("John Smith") === canonicalizeName("Smith, John"));
check('suffixes dropped: "Bob Lee Jr" === "Lee, Bob"', canonicalizeName("Bob Lee Jr") === canonicalizeName("Lee, Bob"));

console.log("\nDate parsing (varied carrier formats):");
check("01/15/2026 parses", parseLooseDate("01/15/2026") !== null);
check("2026-01-16 parses", parseLooseDate("2026-01-16") !== null);
check("1/17/26 parses", parseLooseDate("1/17/26") !== null);
check("'Jan 15 2026' parses", parseLooseDate("Jan 15 2026") !== null);
check("garbage returns null", parseLooseDate("n/a") === null);

console.log("\nMatch scoring + tiers:");
const date = new Date(2026, 0, 15);
const saleSameDay = { customerName: "Smith, John", customerAddress: "123 Main St #4, Lockhart TX 78644", installDate: date };

const high = scoreMatch(
  { customerName: "John Smith", customerAddress: "123 Main Street Apt 4, Lockhart, TX 78644", installDate: date },
  saleSameDay
);
check(`identical-but-formatted-differently → HIGH (got ${high.tier}, ${(high.overall * 100).toFixed(0)}%)`, high.tier === "high");

const wrongName = scoreMatch(
  { customerName: "Jane Doe", customerAddress: "123 Main Street Apt 4, Lockhart, TX 78644", installDate: date },
  saleSameDay
);
check(`same address, wrong name → MEDIUM (got ${wrongName.tier})`, wrongName.tier === "medium");

const different = scoreMatch(
  { customerName: "John Smith", customerAddress: "999 Elsewhere Blvd, Austin TX 78701", installDate: date },
  saleSameDay
);
check(`totally different address → NONE (got ${different.tier})`, different.tier === "none");

console.log("\nbestMatch picks the right sale from a pool:");
const pool = [
  { id: "a", customerName: "Maria Garcia", customerAddress: "456 W Oak Ave, Lockhart TX 78644", installDate: date },
  { id: "b", customerName: "Smith, John", customerAddress: "123 Main St #4, Lockhart TX 78644", installDate: date },
];
const picked = bestMatch(
  { customerName: "John Smith", customerAddress: "123 Main Street Apt 4, Lockhart, TX 78644", installDate: date },
  pool
);
check(`picks sale 'b' (got ${picked?.sale.id ?? "null"})`, picked?.sale.id === "b");

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
