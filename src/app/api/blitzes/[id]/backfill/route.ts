import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveStatus, reinviteRep } from "@/lib/invite-engine";

// Backfill queue (spec §5.2): warm prospects to pull in when a spot frees up —
// reps who were invited but didn't claim (declined / expired / still pending),
// plus the standby waitlist. Admin / FIELD_MANAGER only.

async function buildQueue(blitzId: string) {
  const [invites, waitlist, held] = await Promise.all([
    db.blitzInvite.findMany({ where: { blitzId }, include: { rep: { select: { id: true, name: true, email: true } } } }),
    db.blitzSignup.findMany({
      where: { blitzId, status: "WAITLISTED" },
      orderBy: { waitPosition: "asc" },
      include: { rep: { select: { id: true, name: true, email: true } } },
    }),
    db.blitzSignup.findMany({ where: { blitzId, status: { in: ["CLAIMED", "ACTIVE"] } }, select: { repId: true } }),
  ]);

  const heldIds = new Set(held.map((s) => s.repId));
  const person = (i: (typeof invites)[number]) => ({ repId: i.repId, name: i.rep.name ?? i.rep.email, email: i.rep.email });

  // Reps who got an invite, aren't holding a spot, and didn't accept.
  const declined: ReturnType<typeof person>[] = [];
  const expired: ReturnType<typeof person>[] = [];
  const pending: ReturnType<typeof person>[] = [];
  for (const i of invites) {
    if (heldIds.has(i.repId)) continue;
    const s = effectiveStatus(i);
    if (s === "declined") declined.push(person(i));
    else if (s === "expired") expired.push(person(i));
    else if (s === "pending" || s === "viewed") pending.push(person(i));
  }

  return {
    declined,
    expired,
    pending,
    waitlist: waitlist.map((w) => ({ repId: w.repId, name: w.rep.name ?? w.rep.email, email: w.rep.email, waitPosition: w.waitPosition })),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    return NextResponse.json(await buildQueue(id));
  } catch (error) {
    console.error("[GET /api/blitzes/:id/backfill]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Re-invite one warm prospect: { repId } → resets their invite + re-pings them.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!body.repId) return NextResponse.json({ error: "repId required" }, { status: 400 });

    const result = await reinviteRep(id, body.repId);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/blitzes/:id/backfill]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
