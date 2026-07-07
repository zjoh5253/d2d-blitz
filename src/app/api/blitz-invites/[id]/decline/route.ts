import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { declineInvite } from "@/lib/invite-engine";

// Rep declines a targeted invite.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const result = await declineInvite(id, session.user.id);
    if (result.code === 404) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    if (result.code === 403) return NextResponse.json({ error: "Not your invite" }, { status: 403 });
    if (result.code === 400) return NextResponse.json({ error: result.msg }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/blitz-invites/:id/decline]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
