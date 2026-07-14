import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { effectiveStatus } from "@/lib/invite-engine";

// A rep's own blitz invites (rep mobile app). Listing marks pending invites as
// VIEWED (funnel signal) and returns each with its effective status + the card
// info needed to decide.
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const repId = session.user.id;

    const invites = await db.blitzInvite.findMany({
      where: { repId },
      orderBy: { sentAt: "desc" },
      include: {
        blitz: {
          select: {
            id: true, name: true, status: true, startDate: true, endDate: true, repCap: true,
            market: { select: { name: true, carrier: { select: { name: true } } } },
          },
        },
      },
    });

    // Mark unseen invites as viewed (first open = viewed).
    const unseen = invites.filter((i) => !i.viewedAt && i.status === "SENT").map((i) => i.id);
    if (unseen.length) {
      await db.blitzInvite.updateMany({ where: { id: { in: unseen } }, data: { status: "VIEWED", viewedAt: new Date() } });
    }

    const rows = invites.map((i) => ({
      id: i.id,
      // A CLOSED/REVIEW blitz no longer accepts reps, so its invites aren't
      // actionable regardless of the invite's own state — surface them as
      // expired so the app doesn't offer an Accept that would fail server-side.
      status:
        i.blitz.status === "CLOSED" || i.blitz.status === "REVIEW"
          ? "expired"
          : effectiveStatus(i),
      expiresAt: i.expiresAt,
      blitz: {
        id: i.blitz.id,
        name: i.blitz.name,
        carrier: i.blitz.market.carrier.name,
        market: i.blitz.market.name,
        startDate: i.blitz.startDate,
        endDate: i.blitz.endDate,
      },
    }));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("[GET /api/blitz-invites]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
