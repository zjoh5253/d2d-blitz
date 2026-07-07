import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeReadiness } from "@/lib/gates";

// Manager approves/denies a no-penalty request (Teki #8). Approving recomputes
// the rep's readiness so the waived blitz's misses drop out.
const APPROVERS = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!APPROVERS.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const action = (await request.json().catch(() => ({}))).action as string;
    if (action !== "approve" && action !== "deny") {
      return NextResponse.json({ error: "action must be approve or deny" }, { status: 400 });
    }

    const waiver = await db.penaltyWaiver.findUnique({ where: { id }, select: { id: true, repId: true, status: true } });
    if (!waiver) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const status = action === "approve" ? "APPROVED" : "DENIED";
    await db.penaltyWaiver.update({
      where: { id },
      data: { status, decidedById: session.user.id, decidedAt: new Date() },
    });

    if (status === "APPROVED") await recomputeReadiness(waiver.repId);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("[POST /api/penalty-waivers/:id/decide]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
