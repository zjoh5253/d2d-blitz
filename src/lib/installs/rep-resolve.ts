import { canonicalizeName } from "./match";

export type RepUser = { id: string; name: string | null };

// Levenshtein distance, short-circuited for tokens that differ a lot in length.
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}

// Token match tolerant of a single typo (e.g. "sherrill" vs "sherill").
function tokenEq(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && Math.abs(a.length - b.length) <= 1) return lev(a, b) <= 1;
  return false;
}

// Resolve a carrier report's rep/agent name to a user id. Strips parentheticals
// ("Siosiua (Teki) Koloa" → "Siosiua Koloa"), canonicalizes, and matches on
// token subset or strong overlap. Returns null when no confident match.
export function resolveRepId(reportName: string | null | undefined, users: RepUser[]): string | null {
  if (!reportName) return null;
  const canon = canonicalizeName(reportName.replace(/\([^)]*\)/g, " "));
  if (!canon) return null;
  const repTokens = canon.split(" ").filter(Boolean);
  if (repTokens.length === 0) return null;
  const matchesRep = (t: string) => repTokens.some((rt) => tokenEq(rt, t));

  let best: { id: string; score: number } | null = null;
  for (const u of users) {
    if (!u.name) continue;
    const uTokens = canonicalizeName(u.name).split(" ").filter(Boolean);
    if (uTokens.length === 0) continue;
    const inter = uTokens.filter(matchesRep).length;
    if (inter === 0) continue;
    const subset = uTokens.every(matchesRep); // all of the user's name appears (typo-tolerant)
    const jaccard = inter / (repTokens.length + uTokens.length - inter);
    const score = (subset ? 0.5 : 0) + jaccard;
    if (!best || score > best.score) best = { id: u.id, score };
  }
  return best && best.score >= 0.5 ? best.id : null;
}
