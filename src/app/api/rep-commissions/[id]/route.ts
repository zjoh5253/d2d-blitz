import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { repCommissionOverrideSchema } from "@/lib/validators/common";

type RouteParams = { params: Promise<{ id: string }> };

const overrideInclude = {
  rep: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
} as const;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const override = await db.repCommissionOverride.findUnique({
      where: { id },
      include: overrideInclude,
    });
    if (!override) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }
    return NextResponse.json(override);
  } catch (error) {
    console.error("[GET /api/rep-commissions/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    const parsed = repCommissionOverrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { repId, carrierId, productId, amount, effectiveDate, active } = parsed.data;
    const override = await db.repCommissionOverride.update({
      where: { id },
      data: {
        repId,
        carrierId: carrierId || null,
        productId: productId || null,
        amount,
        effectiveDate: new Date(effectiveDate),
        active,
      },
      include: overrideInclude,
    });

    return NextResponse.json(override);
  } catch (error) {
    console.error("[PUT /api/rep-commissions/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    await db.repCommissionOverride.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/rep-commissions/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
