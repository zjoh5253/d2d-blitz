// Fiber Blitz OS v2 — Sprint 4: board access by readiness band (spec §6.2).
//
// Pure, flag-gated. When BOARD_BAND_GATING is off (default) the board behaves
// exactly as today — every open blitz is visible/claimable — so prod is
// unchanged until the flag is flipped. When on:
//   • Locked (score < 60): no board access at all.
//   • A blitz with a min score floor is hidden/un-claimable below that floor.
//   • Restricted (60-74): may view + claim, but flagged needsApproval (the TL
//     approval inbox is Sprint 5/8; until then the flag is advisory only).
//
// DEFERRED (spec §6.2 premium 24h early-access): premium-band reps seeing a
// "premium blitz" 24h before standard needs a dedicated premium-tier flag on
// the blitz — keying it on the score floor is redundant (a >=90 floor already
// excludes everyone below 90). The `openedForSignupAt` anchor is in place for
// when that flag lands. Until then, no early-access window is applied.
//
// Reps with no computed score yet are treated as the Standard default so they
// are never accidentally locked out.

import { DEFAULT_SCORE } from "@/lib/readiness-score";

export const LOCKED_CEIL = 60; // below this = Locked, no board
export const RESTRICTED_CEIL = 75; // 60-74 = Restricted (claims flagged for review)
export const PREMIUM_FLOOR = 90;

export function boardGatingEnabled(): boolean {
  const v = process.env.BOARD_BAND_GATING;
  return v === "1" || v === "true";
}

export interface BlitzGate {
  minScoreRequired: number | null;
  openedForSignupAt: Date | null;
}

export function repScoreOrDefault(score: number | null | undefined): number {
  return score ?? DEFAULT_SCORE;
}

/** Can this rep SEE the blitz on the board? */
export function canSeeBlitz(repScore: number, b: BlitzGate): boolean {
  if (repScore < LOCKED_CEIL) return false; // Locked: no board access
  if (repScore < (b.minScoreRequired ?? 0)) return false; // below the blitz floor
  return true;
}

/** Can this rep CLAIM the blitz? (Visibility is a prerequisite.) */
export function claimGate(
  repScore: number,
  b: BlitzGate
): { allowed: boolean; needsApproval: boolean; reason?: string } {
  if (repScore < LOCKED_CEIL) {
    return { allowed: false, needsApproval: false, reason: "Your account is locked from the board. Talk to your manager." };
  }
  if (!canSeeBlitz(repScore, b)) {
    return { allowed: false, needsApproval: false, reason: "This blitz requires a higher readiness score." };
  }
  // Restricted band can claim but is flagged for TL review (deferred).
  return { allowed: true, needsApproval: repScore < RESTRICTED_CEIL };
}
