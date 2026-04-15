import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery, optionalId } from "@/lib/validate";

const governancePeriodsQuerySchema = z.object({
  repId: optionalId,
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, governancePeriodsQuerySchema);

    if (!parsed.success) {
      return parsed.response;
    }

    const MANAGER_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];
    const isManager = MANAGER_ROLES.includes(session.user.role);
    // Non-managers (FIELD_REP, RECRUITER, CALL_CENTER) can only see their own records
    const repId = isManager ? parsed.data.repId : session.user.id;
    const month = parsed.data.month;
    const year = parsed.data.year;

    const periods = await db.governancePeriod.findMany({
      where: {
        ...(repId ? { repId } : {}),
        ...(month !== undefined ? { month } : {}),
        ...(year !== undefined ? { year } : {}),
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        tier: { select: { id: true, name: true, rank: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json(periods);
  } catch (error) {
    console.error("[GET /api/governance/periods]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
