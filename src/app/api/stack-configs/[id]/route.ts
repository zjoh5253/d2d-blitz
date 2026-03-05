import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stackConfigSchema } from "@/lib/validators/common";

type RouteParams = { params: Promise<{ id: string }> };

const configInclude = {
  carrier: { select: { id: true, name: true } },
  market: { select: { id: true, name: true } },
} as const;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const config = await db.stackConfig.findUnique({
      where: { id },
      include: configInclude,
    });

    if (!config) {
      return NextResponse.json(
        { error: "Stack config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[GET /api/stack-configs/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
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

    const config = await db.stackConfig.update({
      where: { id },
      data: {
        carrierId,
        marketId: marketId || null,
        companyFloorPercent,
        managerOverridePercent,
        marketOwnerSpreadPercent,
        effectiveDate: new Date(effectiveDate),
      },
      include: configInclude,
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("[PUT /api/stack-configs/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await db.stackConfig.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/stack-configs/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
