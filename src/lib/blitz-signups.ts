import type { Prisma } from "@prisma/client"

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
