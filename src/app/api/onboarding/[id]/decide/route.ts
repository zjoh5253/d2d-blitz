import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflowWaitlist } from "@/lib/blitz-signups";

// Approve or reject a prospective rep (spec §8.1). On approve: account activates
// (slot hold stays → a manager assigns territory, which begins the gates). On
// reject: account marked REJECTED and any held spot is released to the waitlist.
const APPROVERS = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!APPROVERS.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.status !== "ONBOARDING") return NextResponse.json({ error: "This rep isn't awaiting approval." }, { status: 400 });

    if (action === "approve") {
      await db.user.update({ where: { id }, data: { status: "ACTIVE" } });
      return NextResponse.json({ ok: true, status: "ACTIVE" });
    }

    // Reject: release any held spot(s), promote the waitlist, mark rejected.
    const holds = await db.blitzSignup.findMany({ where: { repId: id, status: { in: ["CLAIMED", "WAITLISTED"] } } });
    for (const h of holds) {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM blitzes WHERE id = ${h.blitzId} FOR UPDATE`;
        await tx.blitzSignup.update({ where: { id: h.id }, data: { status: "WITHDRAWN", waitPosition: null } });
        await reflowWaitlist(tx, h.blitzId, { freedSpot: h.status === "CLAIMED", removedWaitPosition: h.status === "WAITLISTED" ? h.waitPosition : null });
      });
    }
    await db.user.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  } catch (error) {
    console.error("[POST /api/onboarding/:id/decide]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
