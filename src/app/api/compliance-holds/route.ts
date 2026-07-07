import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery, optionalId } from "@/lib/validate";
import { captureApiError } from "@/lib/sentry";

const complianceHoldsQuerySchema = z.object({
  repId: optionalId,
  activeOnly: z.string().optional(),
  // YYYY-MM format, e.g. "2024-03"
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
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
    const period = parsed.data.period;

    const MANAGER_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];
    const isManager = MANAGER_ROLES.includes(session.user.role);
    // Non-managers can only view their own compliance holds
    const repId = isManager ? repIdParam : session.user.id;

    let periodFilter: { gte: Date; lt: Date } | undefined;
    if (period) {
      const [year, month] = period.split("-").map(Number);
      periodFilter = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      };
    }

    const holds = await db.complianceHold.findMany({
      where: {
        ...(repId ? { repId } : {}),
        ...(activeOnly ? { restoredDate: null } : {}),
        ...(periodFilter ? { holdDate: periodFilter } : {}),
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
    captureApiError(error, "[GET /api/compliance-holds]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
