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
    const repId = searchParams.get("repId") ?? undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";

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
