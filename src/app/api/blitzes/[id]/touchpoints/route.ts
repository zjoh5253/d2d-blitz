import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MANAGER_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];

/**
 * GET /api/blitzes/:id/touchpoints
 * Manager views all touchpoints for a blitz, with per-rep summary.
 * Restricted to ADMIN, EXECUTIVE, FIELD_MANAGER, MARKET_OWNER.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!MANAGER_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: blitzId } = await params;

    const blitz = await db.blitz.findUnique({ where: { id: blitzId } });
    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 });
    }

    const touchpoints = await db.touchpoint.findMany({
      where: { blitzId },
      include: {
        rep: { select: { id: true, name: true, email: true } },
      },
      orderBy: { timestamp: "desc" },
    });

    // Build per-rep summary
    const repSummary: Record<
      string,
      { repId: string; name: string | null; email: string; count: number; byType: Record<string, number> }
    > = {};

    for (const tp of touchpoints) {
      const key = tp.repId;
      if (!repSummary[key]) {
        repSummary[key] = {
          repId: tp.repId,
          name: tp.rep.name,
          email: tp.rep.email,
          count: 0,
          byType: {},
        };
      }
      repSummary[key].count += 1;
      const typeKey = tp.type;
      repSummary[key].byType[typeKey] = (repSummary[key].byType[typeKey] ?? 0) + 1;
    }

    return NextResponse.json({
      touchpoints,
      repSummary: Object.values(repSummary),
      total: touchpoints.length,
    });
  } catch (error) {
    console.error("[GET /api/blitzes/[id]/touchpoints]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
