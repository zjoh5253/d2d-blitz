export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignments = await db.blitzAssignment.findMany({
      where: {
        repId: session.user.id,
        status: { in: ["ASSIGNED", "CONFIRMED", "ACTIVE"] },
        blitz: { status: "ACTIVE" },
      },
      include: {
        blitz: {
          include: {
            market: { include: { carrier: true } },
          },
        },
      },
    });

    const blitzes = assignments.map((a) => ({
      id: a.blitz.id,
      name: a.blitz.name,
      market: {
        name: a.blitz.market.name,
        carrier: {
          id: a.blitz.market.carrier.id,
          name: a.blitz.market.carrier.name,
        },
      },
    }));

    return NextResponse.json(blitzes);
  } catch (error) {
    console.error("Error fetching active blitz assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch active blitz assignments" },
      { status: 500 }
    );
  }
}
