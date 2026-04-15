import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery, optionalId, CommissionStatusSchema } from "@/lib/validate";

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

    const commissions = await db.commissionRecord.findMany({
      where: {
        ...(repId ? { repId } : {}),
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

    return NextResponse.json(commissions);
  } catch (error) {
    console.error("[GET /api/commissions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
