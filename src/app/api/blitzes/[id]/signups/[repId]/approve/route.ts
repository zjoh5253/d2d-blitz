import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Approve a restricted-band rep's claim (Teki #7) — clears needsApproval so the
// spot locks. The blitz manager / admin does this. Reject uses the existing
// decline route.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; repId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: blitzId, repId } = await params;

    const signup = await db.blitzSignup.findUnique({ where: { blitzId_repId: { blitzId, repId } } });
    if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.blitzSignup.update({
      where: { id: signup.id },
      data: { needsApproval: false, decidedById: session.user.id, decidedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/blitzes/:id/signups/:repId/approve]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
