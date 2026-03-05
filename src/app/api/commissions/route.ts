import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repId = searchParams.get("repId");
    const blitzId = searchParams.get("blitzId");
    const status = searchParams.get("status");

    const commissions = await db.commissionRecord.findMany({
      where: {
        ...(repId ? { repId } : {}),
        ...(blitzId ? { blitzId } : {}),
        ...(status ? { status: status as "ELIGIBLE" | "PENDING" | "ON_HOLD" | "PAID" } : {}),
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
