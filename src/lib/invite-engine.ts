// Fiber Blitz OS v2 — targeted invite engine (spec §6.1, §4.3).
//
// Fires qualification-filtered invites to matching reps over push (now) + SMS
// (via the Sendify seam, no-op until configured), tracks the sent→viewed→
// accepted/declined/expired funnel, and turns an accept into a board signup.
//
// Reuses the shared qualification matcher and the canonical claimSpot helper so
// invite-accept and the open board stay in lockstep.

import { db } from "@/lib/db";
import { getWebPush } from "@/lib/push";
import { qualifiedRepWhere, type QualFilters } from "@/lib/qualification";
import { claimSpot, type ClaimResult } from "@/lib/blitz-signups";
import { sendSms } from "@/lib/integrations/sms";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48h (spec §6.1)
const ACTIVE_SIGNUP = ["CLAIMED", "WAITLISTED", "ACTIVE"] as const;

export type InviteChannel = "push" | "sms" | "both";
export type EffectiveStatus = "pending" | "viewed" | "accepted" | "declined" | "expired";

// Pull the qualification filters off a blitz row.
function filtersFor(b: { minScoreRequired: number | null; qualificationFilters: unknown }): QualFilters {
  const qf = (b.qualificationFilters ?? {}) as { carrierCredentials?: string; experienceMonths?: number };
  return { minScore: b.minScoreRequired, carrierCredential: qf.carrierCredentials ?? null, experienceMonths: qf.experienceMonths ?? null };
}

// Lazy expiry — a SENT/VIEWED invite past its TTL reads as expired without a
// background sweep having to touch it.
export function effectiveStatus(inv: {
  status: string;
  viewedAt: Date | null;
  expiresAt: Date | null;
}, now = new Date()): EffectiveStatus {
  if (inv.status === "ACCEPTED") return "accepted";
  if (inv.status === "DECLINED") return "declined";
  if (inv.status === "EXPIRED") return "expired";
  if (inv.expiresAt && now > inv.expiresAt) return "expired";
  return inv.viewedAt ? "viewed" : "pending";
}

/**
 * Fire invites to all qualified, not-yet-invited, not-yet-signed-up reps.
 * Returns how many were newly invited + push delivery stats.
 */
export async function fireInvitesForBlitz(
  blitzId: string,
  channel: InviteChannel = "both"
): Promise<{ invited: number; alreadyInvited: number; pushSent: number; pushFailed: number; smsConfigured: boolean }> {
  const blitz = await db.blitz.findUnique({
    where: { id: blitzId },
    select: { id: true, name: true, minScoreRequired: true, qualificationFilters: true },
  });
  if (!blitz) throw new Error("Blitz not found");

  const qualified = await db.user.findMany({ where: qualifiedRepWhere(filtersFor(blitz)), select: { id: true } });
  const qualifiedIds = qualified.map((u) => u.id);
  if (qualifiedIds.length === 0) return { invited: 0, alreadyInvited: 0, pushSent: 0, pushFailed: 0, smsConfigured: false };

  // Skip reps already invited or already holding a spot.
  const [invitedRows, signedRows] = await Promise.all([
    db.blitzInvite.findMany({ where: { blitzId, repId: { in: qualifiedIds } }, select: { repId: true } }),
    db.blitzSignup.findMany({ where: { blitzId, repId: { in: qualifiedIds }, status: { in: [...ACTIVE_SIGNUP] } }, select: { repId: true } }),
  ]);
  const skip = new Set([...invitedRows.map((r) => r.repId), ...signedRows.map((r) => r.repId)]);
  const targets = qualifiedIds.filter((id) => !skip.has(id));

  if (targets.length === 0) return { invited: 0, alreadyInvited: invitedRows.length, pushSent: 0, pushFailed: 0, smsConfigured: false };

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db.blitzInvite.createMany({
    data: targets.map((repId) => ({ blitzId, repId, channel, expiresAt })),
    skipDuplicates: true,
  });

  const delivery = await deliverInvites(blitz, targets, channel);
  return { invited: targets.length, alreadyInvited: invitedRows.length, ...delivery };
}

// Push (existing web-push) + SMS seam. Mirrors the notify-signup send path.
async function deliverInvites(
  blitz: { id: string; name: string },
  repIds: string[],
  channel: InviteChannel
): Promise<{ pushSent: number; pushFailed: number; smsConfigured: boolean }> {
  let pushSent = 0;
  let pushFailed = 0;
  let smsConfigured = false;

  if (channel === "push" || channel === "both") {
    const wp = getWebPush();
    if (wp) {
      const subs = await db.pushSubscription.findMany({
        where: { repId: { in: repIds } },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      const payload = JSON.stringify({
        title: "You're invited to a blitz",
        body: `${blitz.name} — tap to accept your spot`,
        url: "/rep/board?tab=invites",
        tag: `blitz-invite-${blitz.id}`,
      });
      for (const s of subs) {
        try {
          await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          pushSent++;
        } catch (e: unknown) {
          pushFailed++;
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }
  }

  if (channel === "sms" || channel === "both") {
    const reps = await db.user.findMany({ where: { id: { in: repIds }, phone: { not: null } }, select: { phone: true } });
    for (const r of reps) {
      const res = await sendSms({ to: r.phone!, body: `You're invited to ${blitz.name}. Open Fiber Blitz to accept.` });
      if (res.delivered) smsConfigured = true;
    }
  }

  return { pushSent, pushFailed, smsConfigured };
}

/** Rep accepts an invite → mark accepted (+ time-to-accept) and claim a spot. */
export async function acceptInvite(inviteId: string, repId: string): Promise<
  | { code: 200; signupStatus: string }
  | { code: 400; msg: string }
  | { code: 403 }
  | { code: 404 }
> {
  const invite = await db.blitzInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { code: 404 };
  if (invite.repId !== repId) return { code: 403 };
  if (effectiveStatus(invite) === "expired") return { code: 400, msg: "This invite has expired." };
  if (invite.status === "DECLINED") return { code: 400, msg: "You declined this invite." };

  const result: ClaimResult = await db.$transaction((tx) => claimSpot(tx, invite.blitzId, repId, { requireOpenForSignup: false }));
  if (result.code !== 200) {
    return result.code === 404 ? { code: 404 } : { code: 400, msg: result.msg };
  }

  await db.blitzInvite.update({
    where: { id: inviteId },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      viewedAt: invite.viewedAt ?? new Date(),
      timeToAccept: Math.round((Date.now() - invite.sentAt.getTime()) / 1000),
    },
  });
  return { code: 200, signupStatus: result.signup.status };
}

/** Rep declines an invite. */
export async function declineInvite(inviteId: string, repId: string): Promise<
  { code: 200 } | { code: 403 } | { code: 404 } | { code: 400; msg: string }
> {
  const invite = await db.blitzInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { code: 404 };
  if (invite.repId !== repId) return { code: 403 };
  if (invite.status === "ACCEPTED") return { code: 400, msg: "You already accepted this invite." };
  await db.blitzInvite.update({ where: { id: inviteId }, data: { status: "DECLINED", declinedAt: new Date() } });
  return { code: 200 };
}

/** Manager funnel: sent → viewed → accepted, plus declined/expired + committed. */
export async function inviteFunnel(blitzId: string) {
  const [invites, committed] = await Promise.all([
    db.blitzInvite.findMany({ where: { blitzId }, select: { status: true, viewedAt: true, expiresAt: true } }),
    db.blitzSignup.count({ where: { blitzId, status: { in: ["CLAIMED", "ACTIVE"] } } }),
  ]);
  const f = { total: invites.length, pending: 0, viewed: 0, accepted: 0, declined: 0, expired: 0, committed };
  for (const inv of invites) {
    const s = effectiveStatus(inv);
    if (s === "accepted") f.accepted++;
    else if (s === "declined") f.declined++;
    else if (s === "expired") f.expired++;
    else if (s === "viewed") f.viewed++;
    else f.pending++;
  }
  return f;
}
