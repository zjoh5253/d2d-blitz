// Smarter install ↔ sale matching. Replaces the brittle exact-string matcher
// (and the dead, divergent matchInstallRecords service). Canonicalizes
// addresses and names, scores candidates, and bins each into a confidence
// tier so the upload pipeline can decide what to auto-verify vs. flag.
//
// Bug fixes baked in vs. the old logic:
//   - No more auto-VERIFY on a weak partial match. Only a HIGH-confidence
//     match verifies a sale; MEDIUM creates an exception for human review.
//   - Address "123 Main St" now matches "123 Main Street" (canonicalization).

const STREET_SUFFIXES: Record<string, string> = {
  street: "st", st: "st",
  avenue: "ave", ave: "ave", av: "ave",
  boulevard: "blvd", blvd: "blvd",
  drive: "dr", dr: "dr",
  road: "rd", rd: "rd",
  lane: "ln", ln: "ln",
  court: "ct", ct: "ct",
  place: "pl", pl: "pl",
  circle: "cir", cir: "cir",
  terrace: "ter", ter: "ter",
  parkway: "pkwy", pkwy: "pkwy",
  highway: "hwy", hwy: "hwy",
  trail: "trl", trl: "trl",
  way: "way",
  loop: "loop",
  square: "sq", sq: "sq",
  crossing: "xing", xing: "xing",
};

const DIRECTIONALS: Record<string, string> = {
  north: "n", n: "n",
  south: "s", s: "s",
  east: "e", e: "e",
  west: "w", w: "w",
  northeast: "ne", ne: "ne",
  northwest: "nw", nw: "nw",
  southeast: "se", se: "se",
  southwest: "sw", sw: "sw",
};

const UNIT_MARKERS = new Set(["apt", "apartment", "unit", "ste", "suite", "no", "number", "fl", "floor", "bldg", "building", "rm", "room"]);

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

function baseClean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeAddress(raw: string): string {
  const cleaned = baseClean(raw);
  const tokens = cleaned.split(" ").filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    if (UNIT_MARKERS.has(tok)) continue; // drop unit words; keep the unit value itself
    if (DIRECTIONALS[tok]) {
      out.push(DIRECTIONALS[tok]);
    } else if (STREET_SUFFIXES[tok]) {
      out.push(STREET_SUFFIXES[tok]);
    } else {
      out.push(tok);
    }
  }
  return out.join(" ");
}

export function canonicalizeName(raw: string): string {
  const cleaned = baseClean(raw);
  const tokens = cleaned
    .split(" ")
    .filter((t) => t && !NAME_SUFFIXES.has(t))
    // sort so "John Smith" == "Smith John" (carriers flip name order)
    .sort();
  return tokens.join(" ");
}

function tokenSet(s: string): Set<string> {
  return new Set(s.split(" ").filter(Boolean));
}

// Jaccard similarity of two token sets, 0–1.
export function jaccard(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

function dateScore(a: Date, b: Date): number {
  const days = Math.abs(a.getTime() - b.getTime()) / 86_400_000;
  if (days < 1) return 1;
  if (days <= 3) return 0.8;
  if (days <= 7) return 0.5;
  if (days <= 14) return 0.25;
  return 0;
}

export type MatchTier = "high" | "medium" | "none";

export type MatchScore = {
  addressScore: number;
  nameScore: number;
  dateScore: number;
  overall: number;
  tier: MatchTier;
};

export type SaleLike = { customerName: string; customerAddress: string; installDate: Date };
export type RecordLike = { customerName: string; customerAddress: string; installDate: Date | null };

export function scoreMatch(record: RecordLike, sale: SaleLike): MatchScore {
  const recAddr = canonicalizeAddress(record.customerAddress);
  const addressScore = jaccard(recAddr, canonicalizeAddress(sale.customerAddress));
  const nameScore = jaccard(canonicalizeName(record.customerName), canonicalizeName(sale.customerName));
  const ds = record.installDate ? dateScore(record.installDate, sale.installDate) : 0.3;
  // Many carrier reports omit the service address on D2D rows (just a name +
  // order #). When the record has no usable address, fall back to name+date.
  const hasAddr = recAddr.length > 0;

  const overall = 0.55 * addressScore + 0.3 * nameScore + 0.15 * ds;

  let tier: MatchTier = "none";
  // HIGH: address essentially identical, name agrees, date plausible → auto-verify.
  if (addressScore >= 0.9 && nameScore >= 0.8 && ds >= 0.5) {
    tier = "high";
  // MEDIUM: strong address but name or date is off → match, but flag for review.
  } else if (addressScore >= 0.8 && (nameScore >= 0.5 || ds >= 0.8)) {
    tier = "medium";
  // MEDIUM (no address): near-exact name + plausible date carries it — flagged
  // for review since we can't confirm the address.
  } else if (!hasAddr && nameScore >= 0.9 && ds >= 0.5) {
    tier = "medium";
  }

  return { addressScore, nameScore, dateScore: ds, overall, tier };
}

// Pick the best-scoring sale for a record from a candidate list. Returns null
// when nothing clears the MEDIUM bar.
export function bestMatch<T extends SaleLike>(
  record: RecordLike,
  candidates: T[]
): { sale: T; score: MatchScore } | null {
  let best: { sale: T; score: MatchScore } | null = null;
  for (const sale of candidates) {
    const score = scoreMatch(record, sale);
    if (score.tier === "none") continue;
    if (!best || score.overall > best.score.overall) best = { sale, score };
  }
  return best;
}
