// Fiber Blitz OS v2 — Sprint 5/6: check-in gate system (spec §9) + the bridge
// that feeds real gate outcomes into the Readiness Score (spec §10).
//
// Gates are scheduled per slot (= BlitzSignup) when a rep is activated. G0 is
// auto-satisfied (the rep already accepted via the board/invite; real e-sign
// drops into the esign seam later). G1-G5 fire on schedule; the rep completes
// each via /api/gates/[gateId]/complete. G4 is a geofence check — territory
// polygons are deferred, so we fall back to a radius around the blitz's lead
// centroid (spec §9.1 hotel-radius fallback).

import { db } from "@/lib/db";
import {
  computeReadinessScore,
  type GateOutcome,
  type NoShowEvent,
} from "@/lib/readiness-score";

// gateId → action + score weight. Weights mirror readiness-score GATE_WEIGHTS.
export const GATE_DEFS = [
  { id: "G0", action: "acknowledge", weight: 5, label: "Accept terms" },
  { id: "G1", action: "acknowledge", weight: 20, label: "Roster lock — reconfirm" },
  { id: "G2", action: "checklist", weight: 15, label: "Gear & credential checklist" },
  { id: "G3", action: "eta_submission", weight: 30, label: "Final confirm — submit ETA" },
  { id: "G4", action: "geofence", weight: 30, label: "Day-of check-in" },
  { id: "G5", action: "production_numbers", weight: 10, label: "Daily close" },
] as const;

export const GEOFENCE_RADIUS_M = 8000; // ~5mi fallback around the lead centroid
const SIX_MONTHS_MS = 182 * 24 * 60 * 60 * 1000;

function addDaysUTC(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// Default blitz timezone when one isn't stored (central US — a reasonable middle
// of the footprint). Gate times are "local to the blitz location" (Teki #3).
export const DEFAULT_BLITZ_TZ = "America/Chicago";

// Rough US state → IANA timezone (dominant zone for split states). Used to stamp
// blitz.timezone at creation so gate times land in the blitz's local time.
const STATE_TZ: Record<string, string> = {
  CT: "America/New_York", DE: "America/New_York", FL: "America/New_York", GA: "America/New_York",
  IN: "America/New_York", ME: "America/New_York", MD: "America/New_York", MA: "America/New_York",
  MI: "America/New_York", NH: "America/New_York", NJ: "America/New_York", NY: "America/New_York",
  NC: "America/New_York", OH: "America/New_York", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", VT: "America/New_York", VA: "America/New_York", WV: "America/New_York", KY: "America/New_York",
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago",
  KS: "America/Chicago", LA: "America/Chicago", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", NE: "America/Chicago", ND: "America/Chicago", OK: "America/Chicago",
  SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
  AZ: "America/Phoenix", CO: "America/Denver", ID: "America/Denver", MT: "America/Denver",
  NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
};

export function timezoneForState(state?: string | null): string | null {
  if (!state) return null;
  return STATE_TZ[state.toUpperCase()] ?? null;
}

// Resolve a wall-clock time (HH:MM on the calendar date of `base`) in `tz` to the
// correct UTC instant, DST-aware. Uses the Intl offset trick (no tz library).
function zonedWallClock(base: Date, hour: number, minute: number, tz: string): Date {
  const naiveUtc = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute));
  const inTz = new Date(naiveUtc.toLocaleString("en-US", { timeZone: tz }));
  const inUtc = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = inTz.getTime() - inUtc.getTime();
  return new Date(naiveUtc.getTime() - offset);
}

// When each gate should fire, in the blitz's LOCAL time (Teki #3). G5 = 11:30pm
// local for daily production numbers + pipeline submissions (Teki #6).
export function gateTriggerTime(gateId: string, start: Date, end: Date, now: Date, tz: string = DEFAULT_BLITZ_TZ): Date {
  switch (gateId) {
    case "G0": return now; // immediate on activation
    case "G1": return zonedWallClock(addDaysUTC(start, -7), 9, 0, tz);
    case "G2": return zonedWallClock(addDaysUTC(start, -3), 18, 0, tz);
    case "G3": return zonedWallClock(addDaysUTC(start, -1), 10, 0, tz);
    case "G4": return zonedWallClock(start, 9, 0, tz);
    case "G5": return zonedWallClock(end, 23, 30, tz);
    default: return now;
  }
}

/** Create the 6 gates for a freshly-activated slot. Idempotent. */
export async function scheduleGatesForSlot(slotId: string, blitz: { startDate: Date; endDate: Date; timezone?: string | null }): Promise<void> {
  const now = new Date();
  const tz = blitz.timezone || DEFAULT_BLITZ_TZ;
  await db.checkInGate.createMany({
    data: GATE_DEFS.map((g) => ({
      blitzSlotId: slotId,
      gateId: g.id,
      scheduledTriggerTime: gateTriggerTime(g.id, blitz.startDate, blitz.endDate, now, tz),
      requiredActionType: g.action,
      scoreImpact: g.weight,
      // G0 is satisfied by the act of accepting; everything else is pending.
      status: g.id === "G0" ? "COMPLETED" : "PENDING",
    })),
    skipDuplicates: true,
  });
  // Record G0's completion so the funnel/score see it as done.
  await db.gateCompletion.upsert({
    where: { blitzSlotId_gateId: { blitzSlotId: slotId, gateId: "G0" } },
    create: { blitzSlotId: slotId, gateId: "G0", completedAt: now, onFirstPush: true, nudgesRequired: 0 },
    update: {},
  });
}

// Haversine distance in metres.
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function withinRadius(point: { lat: number; lng: number }, center: { lat: number; lng: number }, radiusM: number): boolean {
  return distanceM(point, center) <= radiusM;
}

// Centroid of a blitz's knockable leads — the geofence fallback center.
async function blitzCenter(blitzId: string): Promise<{ lat: number; lng: number } | null> {
  const agg = await db.doorKnockLead.aggregate({
    where: { blitzId, lat: { not: null }, lng: { not: null } },
    _avg: { lat: true, lng: true },
  });
  if (agg._avg.lat == null || agg._avg.lng == null) return null;
  return { lat: agg._avg.lat, lng: agg._avg.lng };
}

export type CompleteResult = { code: 200 } | { code: 400; msg: string } | { code: 403 } | { code: 404; msg?: string };

/** Rep completes a gate action. Geofence gates verify location first. */
export async function completeGate(
  slotId: string,
  gateId: string,
  repId: string,
  opts: { lat?: number; lng?: number } = {}
): Promise<CompleteResult> {
  const slot = await db.blitzSignup.findUnique({ where: { id: slotId }, select: { repId: true, blitzId: true } });
  if (!slot) return { code: 404, msg: "Slot not found" };
  if (slot.repId !== repId) return { code: 403 };

  const gate = await db.checkInGate.findUnique({ where: { blitzSlotId_gateId: { blitzSlotId: slotId, gateId } } });
  if (!gate) return { code: 404, msg: "Gate not scheduled" };
  if (gate.status === "COMPLETED") return { code: 200 }; // idempotent

  if (gate.requiredActionType === "geofence") {
    if (opts.lat == null || opts.lng == null) return { code: 400, msg: "Location required to check in." };
    const center = await blitzCenter(slot.blitzId);
    if (center && !withinRadius({ lat: opts.lat, lng: opts.lng }, center, GEOFENCE_RADIUS_M)) {
      return { code: 400, msg: "You're not within the blitz territory yet." };
    }
  }

  // How many nudges it took drives the score: 0 = first push (100), 1 (80),
  // 2+ (50) — see readiness-score gateOutcomeScore.
  await db.$transaction([
    db.checkInGate.update({ where: { id: gate.id }, data: { status: "COMPLETED" } }),
    db.gateCompletion.upsert({
      where: { blitzSlotId_gateId: { blitzSlotId: slotId, gateId } },
      create: { blitzSlotId: slotId, gateId, completedAt: new Date(), onFirstPush: gate.nudges === 0, nudgesRequired: gate.nudges },
      update: { completedAt: new Date(), onFirstPush: gate.nudges === 0, nudgesRequired: gate.nudges },
    }),
  ]);

  await recomputeReadiness(repId);
  return { code: 200 };
}

/**
 * Recompute a rep's Readiness Score from their real gate history (last 6mo) and
 * persist score + band. G0 (auto-satisfied entry gate) is excluded so a brand-
 * new rep with only G0 doesn't vault to a perfect score — they stay at the
 * Standard default until they've been through real gates.
 */
export async function recomputeReadiness(repId: string): Promise<{ score: number; band: string }> {
  const since = new Date(Date.now() - SIX_MONTHS_MS);
  const [completions, missedRaw, waivers] = await Promise.all([
    db.gateCompletion.findMany({
      where: { slot: { repId }, completedAt: { gte: since }, gateId: { not: "G0" } },
      select: { gateId: true, onFirstPush: true, nudgesRequired: true },
    }),
    db.checkInGate.findMany({
      // Both auto-reopened (MISSED) and escalated gates score as a miss (0).
      where: { slot: { repId }, status: { in: ["MISSED", "ESCALATED"] }, scheduledTriggerTime: { gte: since }, gateId: { not: "G0" } },
      select: { gateId: true, scheduledTriggerTime: true, slot: { select: { blitzId: true } } },
    }),
    // Approved no-penalty waivers (Teki #8) — their blitz's misses are skipped.
    db.penaltyWaiver.findMany({ where: { repId, status: "APPROVED" }, select: { blitzId: true } }),
  ]);

  const waived = new Set(waivers.map((w) => w.blitzId));
  const missed = missedRaw.filter((m) => !waived.has(m.slot.blitzId));

  const outcomes: GateOutcome[] = [
    ...completions.map((c) => ({ gateId: c.gateId, onFirstPush: c.onFirstPush, nudgesRequired: c.nudgesRequired })),
    ...missed.map((m) => ({ gateId: m.gateId, missed: true })),
  ];
  const noShows: NoShowEvent[] = missed
    .filter((m) => m.gateId === "G4" && m.scheduledTriggerTime)
    .map((m) => ({ occurredAt: m.scheduledTriggerTime as Date }));

  const { score, band } = computeReadinessScore(outcomes, noShows);
  await db.user.update({ where: { id: repId }, data: { blitzReadinessScore: score, scoreBand: band } });
  return { score, band };
}
