import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery, optionalId, CommissionStatusSchema } from "@/lib/validate";
import { captureApiError } from "@/lib/sentry";
import { redactCommission } from "@/lib/services/commission-visibility";

const commissionsQuerySchema = z.object({
  repId: optionalId,
  blitzId: optionalId,
  status: CommissionStatusSchema.optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, commissionsQuerySchema);

    if (!parsed.success) {
      return parsed.response;
    }

    const { repId, blitzId, status } = parsed.data;

    // Non-manager roles can only see their own commissions
    const MANAGER_ROLES = ["ADMIN", "EXECUTIVE", "MARKET_OWNER", "FIELD_MANAGER"];
    const effectiveRepId = MANAGER_ROLES.includes(session.user.role)
      ? repId
      : session.user.id;

    const commissions = await db.commissionRecord.findMany({
      where: {
        ...(effectiveRepId ? { repId: effectiveRepId } : {}),
        ...(blitzId ? { blitzId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        rep: { select: { id: true, name: true } },
        blitz: { select: { id: true, name: true } },
        governanceTier: { select: { id: true, name: true } },
        sale: {
          include: {
            carrier: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Strip upstream economics the caller's role may not see (PRD §16).
    const visible = commissions.map((c) => redactCommission(c, session.user.role));

    return NextResponse.json(visible);
  } catch (error) {
    console.error("[GET /api/commissions]", error);
    captureApiError(error, "[GET /api/commissions]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
