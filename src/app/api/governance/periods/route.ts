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
    const month = searchParams.get("month")
      ? parseInt(searchParams.get("month")!)
      : undefined;
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;

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
