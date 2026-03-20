import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repId = session.user.id;

    const activeAssignment = await db.blitzAssignment.findFirst({
      where: {
        repId,
        status: { in: ["ASSIGNED", "CONFIRMED", "IN_TRANSIT", "ACTIVE"] },
        blitz: { status: { in: ["ACTIVE", "READY"] } },
      },
      include: {
        blitz: {
          include: {
            market: { include: { carrier: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      activeAssignment: activeAssignment
        ? {
            id: activeAssignment.id,
            status: activeAssignment.status,
            blitz: {
              id: activeAssignment.blitz.id,
              name: activeAssignment.blitz.name,
              startDate: activeAssignment.blitz.startDate,
              endDate: activeAssignment.blitz.endDate,
              status: activeAssignment.blitz.status,
              market: {
                name: activeAssignment.blitz.market.name,
                carrier: activeAssignment.blitz.market.carrier
                  ? { name: activeAssignment.blitz.market.carrier.name }
                  : undefined,
              },
            },
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching active assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch active assignment" },
      { status: 500 }
    );
  }
}
