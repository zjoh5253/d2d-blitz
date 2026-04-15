import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery, optionalId } from "@/lib/validate";

const complianceHoldsQuerySchema = z.object({
  repId: optionalId,
  activeOnly: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, complianceHoldsQuerySchema);

    if (!parsed.success) {
      return parsed.response;
    }

    const repIdParam = parsed.data.repId;
    const activeOnly = parsed.data.activeOnly === "true";

    const MANAGER_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];
    const isManager = MANAGER_ROLES.includes(session.user.role);
    // Non-managers can only view their own compliance holds
    const repId = isManager ? repIdParam : session.user.id;

    const holds = await db.complianceHold.findMany({
      where: {
        ...(repId ? { repId } : {}),
        ...(activeOnly ? { restoredDate: null } : {}),
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        restoredBy: { select: { id: true, name: true } },
      },
      orderBy: { holdDate: "desc" },
    });

    return NextResponse.json(holds);
  } catch (error) {
    console.error("[GET /api/compliance-holds]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
