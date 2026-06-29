// Fiber Blitz OS v2 — Blitz Readiness Score (spec §9 weights, §10 computation).
//
// Rolling 6-month, 0-100. Gates board access (score_band) and invite priority.
// This is the spec's reliability/gate-completion score — SEPARATE from the
// install-rate GovernanceTier, which keeps driving commission + leaderboard.
//
// Pure functions only (no DB) so they're unit-testable and reusable by the
// gate runner, the board gate, and the seed/backfill script.

export type Band = "premium" | "standard" | "restricted" | "locked";

// New reps enter at Standard and prove out from there (spec §8.2).
export const DEFAULT_SCORE = 75;
export const DEFAULT_BAND: Band = "standard";

// Per-gate weights (spec §9). They intentionally sum to 110, not 100 — the
// score is a *weighted average*, so we always divide by the summed weight of
// the gates actually present, which normalizes regardless of the total.
export const GATE_WEIGHTS: Record<string, number> = {
  G0: 5,
  G1: 20,
  G2: 15,
  G3: 30,
  G4: 30,
  G5: 10,
};

// Absolute penalty for a G4 geofence no-show, applied to the rolling score for
// 90 days from the no-show date (spec §10.1).
export const NO_SHOW_PENALTY = 25;
export const NO_SHOW_PENALTY_DAYS = 90;

// One gate's completion record, as stored in gate_completions (+ a `missed`
// flag the gate runner sets when a gate is escalated / auto-reopened).
export interface GateOutcome {
  gateId: string; // 'G0'..'G5'
  missed?: boolean; // escalated or auto-reopened -> 0
  onFirstPush?: boolean | null;
  nudgesRequired?: number | null;
}

// A G4 no-show event, used to apply the time-boxed absolute penalty.
export interface NoShowEvent {
  occurredAt: Date;
}

// Per-gate quality score (spec §10.1):
//   first push, no nudges -> 100 · 1 nudge -> 80 · 2+ nudges/TL outreach -> 50
//   missed (escalated / auto-reopened) -> 0
export function gateOutcomeScore(o: GateOutcome): number {
  if (o.missed) return 0;
  const nudges = o.nudgesRequired ?? 0;
  if (nudges >= 2) return 50;
  if (nudges === 1) return 80;
  // Completed on first push, or completed with unknown provenance -> clean 100.
  return 100;
}

/**
 * Compute a rep's rolling readiness score + band.
 *
 * @param outcomes  gate outcomes within the rolling 6-month window
 * @param noShows   G4 no-show events (any date; only those inside the 90-day
 *                  penalty window as of `asOf` are applied)
 * @param asOf      evaluation date (defaults to the caller's "now")
 *
 * With no outcomes the rep sits at the Standard entry default — this is the
 * new-rep case and also keeps the board usable before any gates have run.
 */
export function computeReadinessScore(
  outcomes: GateOutcome[],
  noShows: NoShowEvent[] = [],
  asOf: Date = new Date()
): { score: number; band: Band } {
  let base: number;
  if (outcomes.length === 0) {
    base = DEFAULT_SCORE;
  } else {
    let weighted = 0;
    let totalWeight = 0;
    for (const o of outcomes) {
      const w = GATE_WEIGHTS[o.gateId] ?? 0;
      if (w === 0) continue;
      weighted += gateOutcomeScore(o) * w;
      totalWeight += w;
    }
    base = totalWeight > 0 ? weighted / totalWeight : DEFAULT_SCORE;
  }

  // Active no-show penalties (within 90 days of asOf), stacked.
  const cutoff = asOf.getTime() - NO_SHOW_PENALTY_DAYS * 86_400_000;
  const activePenalties = noShows.filter((n) => n.occurredAt.getTime() >= cutoff).length;
  const score = clamp(base - activePenalties * NO_SHOW_PENALTY, 0, 100);

  return { score: Math.round(score * 10) / 10, band: bandFor(score) };
}

// Score -> band (spec §6.2 / §10).
export function bandFor(score: number): Band {
  if (score >= 90) return "premium";
  if (score >= 75) return "standard";
  if (score >= 60) return "restricted";
  return "locked";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
