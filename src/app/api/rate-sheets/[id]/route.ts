import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateSheetSchema } from "@/lib/validators/common";
import { checkGrantMargin } from "@/lib/services/min-margin";

type RouteParams = { params: Promise<{ id: string }> };

const sheetInclude = {
  principal: { select: { id: true, name: true, role: true } },
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
    const sheet = await db.rateSheet.findUnique({ where: { id }, include: sheetInclude });
    if (!sheet) {
      return NextResponse.json({ error: "Rate sheet not found" }, { status: 404 });
    }
    return NextResponse.json(sheet);
  } catch (error) {
    console.error("[GET /api/rate-sheets/[id]]", error);
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
    const parsed = rateSheetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { level, principalId, carrierId, productId, availableRevenue, effectiveDate, active, overrideMinMargin } =
      parsed.data;

    if (level === "OWNER") {
      const margin = await checkGrantMargin({
        carrierId: carrierId || "",
        productId: productId || null,
        availableRevenue,
        override: overrideMinMargin,
      });
      if (!margin.ok) {
        return NextResponse.json({ error: margin.message }, { status: 422 });
      }
    }

    const sheet = await db.rateSheet.update({
      where: { id },
      data: {
        level,
        principalId,
        carrierId: carrierId || null,
        productId: productId || null,
        availableRevenue,
        effectiveDate: new Date(effectiveDate),
        active,
      },
      include: sheetInclude,
    });

    return NextResponse.json(sheet);
  } catch (error) {
    console.error("[PUT /api/rate-sheets/[id]]", error);
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
    await db.rateSheet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/rate-sheets/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
