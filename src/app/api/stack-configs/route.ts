import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stackConfigSchema } from "@/lib/validators/common";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configs = await db.stackConfig.findMany({
      orderBy: { effectiveDate: "desc" },
      include: {
        carrier: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("[GET /api/stack-configs]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = stackConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      carrierId,
      marketId,
      companyFloorPercent,
      managerOverridePercent,
      marketOwnerSpreadPercent,
      effectiveDate,
    } = parsed.data;

    const config = await db.stackConfig.create({
      data: {
        carrierId,
        marketId: marketId || null,
        companyFloorPercent,
        managerOverridePercent,
        marketOwnerSpreadPercent,
        effectiveDate: new Date(effectiveDate),
      },
      include: {
        carrier: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("[POST /api/stack-configs]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
