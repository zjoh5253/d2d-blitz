import type { Prisma } from "@prisma/client"

type LockedBlitz = { id: string; rep_cap: number; open_for_signup: boolean; status: string }

export type ClaimResult =
  | { code: 200; signup: { id: string; status: string; waitPosition: number | null } }
  | { code: 404 }
  | { code: 400; msg: string }

// Canonical "rep takes a spot" used by the invite-accept flow (and available to
// the open-board claim). MUST run inside a transaction that locks the blitz row.
// CLAIMED if under repCap, else WAITLISTED; idempotent for an existing active
// signup. `requireOpenForSignup` is true for the board (a rep self-claiming an
// open blitz) and false for invite-accept (the invite itself is the authority,
// so it works even before the board opens to everyone).
export async function claimSpot(
  tx: Prisma.TransactionClient,
  blitzId: string,
  repId: string,
  opts: { requireOpenForSignup: boolean }
): Promise<ClaimResult> {
  const locked = await tx.$queryRaw<LockedBlitz[]>`
    SELECT id, rep_cap, open_for_signup, status FROM blitzes WHERE id = ${blitzId} FOR UPDATE`
  const b = locked[0]
  if (!b) return { code: 404 }
  if (b.status === "CLOSED" || b.status === "REVIEW") return { code: 400, msg: "This blitz isn't accepting reps." }
  if (opts.requireOpenForSignup && !b.open_for_signup) {
    return { code: 400, msg: "This blitz isn't open for signup." }
  }

  const existing = await tx.blitzSignup.findUnique({ where: { blitzId_repId: { blitzId, repId } } })
  if (existing && (existing.status === "CLAIMED" || existing.status === "WAITLISTED" || existing.status === "ACTIVE")) {
    return { code: 200, signup: existing }
  }

  const claimed = await tx.blitzSignup.count({ where: { blitzId, status: { in: ["CLAIMED", "ACTIVE"] } } })
  let status: "CLAIMED" | "WAITLISTED" = "CLAIMED"
  let waitPosition: number | null = null
  if (claimed >= b.rep_cap) {
    status = "WAITLISTED"
    waitPosition = (await tx.blitzSignup.count({ where: { blitzId, status: "WAITLISTED" } })) + 1
  }

  const signup = existing
    ? await tx.blitzSignup.update({
        where: { id: existing.id },
        data: { status, waitPosition, claimedAt: new Date(), activatedAt: null, decidedAt: null, decidedById: null },
      })
    : await tx.blitzSignup.create({ data: { blitzId, repId, status, waitPosition } })
  return { code: 200, signup }
}

// Shared waitlist bookkeeping for the rep job board. Always call inside a
// transaction that has already locked the blitz row (SELECT ... FOR UPDATE) so
// concurrent claims/withdraws can't corrupt the queue.
//
// - freedSpot: a CLAIMED/ACTIVE rep just left, opening a reserved spot → promote
//   the head of the waitlist (lowest waitPosition) into it.
// - removedWaitPosition: a WAITLISTED rep just left from this position → close
//   the gap by decrementing everyone behind them.
export async function reflowWaitlist(
  tx: Prisma.TransactionClient,
  blitzId: string,
  opts: { freedSpot: boolean; removedWaitPosition: number | null }
): Promise<void> {
  if (opts.freedSpot) {
    const next = await tx.blitzSignup.findFirst({
      where: { blitzId, status: "WAITLISTED" },
      orderBy: { waitPosition: "asc" },
    })
    if (next) {
      await tx.blitzSignup.update({
        where: { id: next.id },
        data: { status: "CLAIMED", waitPosition: null },
      })
      await tx.blitzSignup.updateMany({
        where: { blitzId, status: "WAITLISTED", waitPosition: { gt: next.waitPosition ?? 0 } },
        data: { waitPosition: { decrement: 1 } },
      })
    }
  } else if (opts.removedWaitPosition != null) {
    await tx.blitzSignup.updateMany({
      where: { blitzId, status: "WAITLISTED", waitPosition: { gt: opts.removedWaitPosition } },
      data: { waitPosition: { decrement: 1 } },
    })
  }
}
