import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { acceptInvite } from "@/lib/invite-engine";

// Rep accepts a targeted invite → claims a board spot (CLAIMED or WAITLISTED).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const result = await acceptInvite(id, session.user.id);
    if (result.code === 404) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    if (result.code === 403) return NextResponse.json({ error: "Not your invite" }, { status: 403 });
    if (result.code === 400) return NextResponse.json({ error: result.msg }, { status: 400 });
    return NextResponse.json({ ok: true, signupStatus: result.signupStatus });
  } catch (error) {
    console.error("[POST /api/blitz-invites/:id/accept]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
