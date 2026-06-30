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

function atHourUTC(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}
function addDaysUTC(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// When each gate should fire, relative to the blitz window (UTC approximation —
// these drive notifications, not money).
export function gateTriggerTime(gateId: string, start: Date, end: Date, now: Date): Date {
  switch (gateId) {
    case "G0": return now; // immediate on activation
    case "G1": return atHourUTC(addDaysUTC(start, -7), 9);
    case "G2": return atHourUTC(addDaysUTC(start, -3), 18);
    case "G3": return atHourUTC(addDaysUTC(start, -1), 10);
    case "G4": return atHourUTC(start, 9);
    case "G5": return atHourUTC(end, 20);
    default: return now;
  }
}

/** Create the 6 gates for a freshly-activated slot. Idempotent. */
export async function scheduleGatesForSlot(slotId: string, blitz: { startDate: Date; endDate: Date }): Promise<void> {
  const now = new Date();
  await db.checkInGate.createMany({
    data: GATE_DEFS.map((g) => ({
      blitzSlotId: slotId,
      gateId: g.id,
      scheduledTriggerTime: gateTriggerTime(g.id, blitz.startDate, blitz.endDate, now),
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

  await db.$transaction([
    db.checkInGate.update({ where: { id: gate.id }, data: { status: "COMPLETED" } }),
    db.gateCompletion.upsert({
      where: { blitzSlotId_gateId: { blitzSlotId: slotId, gateId } },
      create: { blitzSlotId: slotId, gateId, completedAt: new Date(), onFirstPush: true, nudgesRequired: 0 },
      update: { completedAt: new Date() },
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
  const [completions, missed] = await Promise.all([
    db.gateCompletion.findMany({
      where: { slot: { repId }, completedAt: { gte: since }, gateId: { not: "G0" } },
      select: { gateId: true, onFirstPush: true, nudgesRequired: true },
    }),
    db.checkInGate.findMany({
      // Both auto-reopened (MISSED) and escalated gates score as a miss (0).
      where: { slot: { repId }, status: { in: ["MISSED", "ESCALATED"] }, scheduledTriggerTime: { gte: since }, gateId: { not: "G0" } },
      select: { gateId: true, scheduledTriggerTime: true },
    }),
  ]);

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
