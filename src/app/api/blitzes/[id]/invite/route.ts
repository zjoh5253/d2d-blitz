import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fireInvitesForBlitz, inviteFunnel, type InviteChannel } from "@/lib/invite-engine";

// Manager fires targeted invites (POST) and reads the invite funnel (GET).
// Admin / FIELD_MANAGER only. Like "Notify reps", firing is an EXPLICIT action,
// never automatic on create — so test blitzes never invite anyone.

const CHANNELS: InviteChannel[] = ["push", "sms", "both"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const channel: InviteChannel = CHANNELS.includes(body.channel) ? body.channel : "both";

    const result = await fireInvitesForBlitz(id, channel);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "Blitz not found") {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 });
    }
    console.error("[POST /api/blitzes/:id/invite]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    return NextResponse.json(await inviteFunnel(id));
  } catch (error) {
    console.error("[GET /api/blitzes/:id/invite]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
