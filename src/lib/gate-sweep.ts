// Fiber Blitz OS v2 — gate sweep, per Teki's decisions.
//
// #1 Nudges: an overdue gate gets a spaced reminder push each tick; only after
//    >=5 nudges (still incomplete) is it officially MISSED. The nudge count then
//    drives the score (0 nudges=100, 1=80, 2+=50).
// #2 Manager heads-up first: a missed pre-blitz gate (G1/G2/G3) ESCALATES and
//    pushes the BLITZ MANAGER — NO silent auto-reopen. The manager decides
//    (existing roster controls free the spot + promote the waitlist). G4 = no-
//    show, G5 = minor miss; both feed the readiness penalty via recompute.
// Idempotent — PENDING gates stay PENDING through nudging, flip once on miss.

import { db } from "@/lib/db";
import { getWebPush } from "@/lib/push";
import { recomputeReadiness, GATE_DEFS } from "@/lib/gates";

export const NUDGE_THRESHOLD = 5; // >=5 reminder pushes before "missed" (Teki #1)
const NUDGE_INTERVAL_MS = 60 * 60 * 1000; // space reminders ~1h apart
const ESCALATE_GATES = new Set(["G1", "G2", "G3"]); // miss -> manager heads-up (Teki #2)

const GATE_LABEL: Record<string, string> = Object.fromEntries(GATE_DEFS.map((g) => [g.id, g.label]));

// Push a payload to one user's subscriptions (prunes stale endpoints).
async function pushToUser(userId: string, payload: Record<string, unknown>): Promise<void> {
  const wp = getWebPush();
  if (!wp) return;
  const subs = await db.pushSubscription.findMany({ where: { repId: userId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  const body = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    }
  }
}

export async function sweepGates(now: Date = new Date()): Promise<{ nudged: number; missed: number; escalated: number }> {
  const due = await db.checkInGate.findMany({
    // Only blitzes whose staffing the manager has finalized — a draft blitz
    // never nudges/notifies reps, so mid-staffing mistakes stay silent.
    where: { status: "PENDING", scheduledTriggerTime: { lte: now }, slot: { blitz: { staffingPublishedAt: { not: null } } } },
    select: {
      id: true,
      gateId: true,
      nudges: true,
      lastNudgedAt: true,
      slot: {
        select: {
          repId: true,
          blitzId: true,
          rep: { select: { name: true, email: true } },
          blitz: { select: { name: true, managerId: true } },
        },
      },
    },
  });

  let nudged = 0;
  let missed = 0;
  let escalated = 0;
  const affectedReps = new Set<string>();

  for (const g of due) {
    if (g.nudges >= NUDGE_THRESHOLD) {
      // Officially missed after >=5 nudges.
      const escalate = ESCALATE_GATES.has(g.gateId);
      await db.checkInGate.update({
        where: { id: g.id },
        data: { status: escalate ? "ESCALATED" : "MISSED", ...(escalate ? { escalationTargetId: g.slot.blitz.managerId } : {}) },
      });
      missed++;
      affectedReps.add(g.slot.repId);
      if (escalate) {
        escalated++;
        // Manager heads-up first (Teki #2) — no silent reopen.
        await pushToUser(g.slot.blitz.managerId, {
          title: "Rep missed a check-in",
          body: `${g.slot.rep.name ?? g.slot.rep.email} missed “${GATE_LABEL[g.gateId] ?? g.gateId}” — ${g.slot.blitz.name}`,
          url: `/dashboard/blitzes/${g.slot.blitzId}`,
          tag: `gate-miss-${g.id}`,
        });
      }
    } else {
      // Not missed yet — send a spaced reminder nudge (status stays PENDING).
      const last = g.lastNudgedAt?.getTime() ?? 0;
      if (now.getTime() - last >= NUDGE_INTERVAL_MS) {
        await db.checkInGate.update({ where: { id: g.id }, data: { nudges: { increment: 1 }, lastNudgedAt: now } });
        await pushToUser(g.slot.repId, {
          title: "Check-in due",
          body: `${GATE_LABEL[g.gateId] ?? g.gateId} — ${g.slot.blitz.name}`,
          url: "/rep/board",
          tag: `gate-nudge-${g.id}`,
        });
        nudged++;
      }
    }
  }

  for (const repId of affectedReps) await recomputeReadiness(repId);
  return { nudged, missed, escalated };
}
