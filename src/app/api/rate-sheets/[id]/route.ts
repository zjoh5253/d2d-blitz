import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateSheetSchema } from "@/lib/validators/common";
import { checkGrantMargin, checkManagerGrantMargin } from "@/lib/services/min-margin";
import { getManagerScope } from "@/lib/services/payroll-scope";

type RouteParams = { params: Promise<{ id: string }> };

const sheetInclude = {
  principal: { select: { id: true, name: true, role: true } },
  carrier: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
} as const;

/**
 * A MARKET_OWNER may only reach a rate sheet that is a MANAGER grant to one of
 * their downline managers. Returns true for ADMIN, or for an owner in-scope.
 */
async function canReachSheet(
  user: { id: string; role: string },
  sheet: { level: string; principalId: string }
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "MARKET_OWNER") return false;
  if (sheet.level !== "MANAGER") return false;
  const { managerIds } = await getManagerScope(user);
  return managerIds.includes(sheet.principalId);
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "MARKET_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sheet = await db.rateSheet.findUnique({ where: { id }, include: sheetInclude });
    if (!sheet) {
      return NextResponse.json({ error: "Rate sheet not found" }, { status: 404 });
    }
    if (!(await canReachSheet(session.user, sheet))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    if (session.user.role !== "ADMIN" && session.user.role !== "MARKET_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Guard the record being edited (an owner can't touch OWNER / out-of-scope sheets).
    const existing = await db.rateSheet.findUnique({
      where: { id },
      select: { level: true, principalId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Rate sheet not found" }, { status: 404 });
    }
    if (!(await canReachSheet(session.user, existing))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    if (session.user.role === "MARKET_OWNER") {
      // The new target must also stay MANAGER + in-scope, capped at owner revenue.
      const { managerIds } = await getManagerScope(session.user);
      if (level !== "MANAGER" || !managerIds.includes(principalId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const margin = await checkManagerGrantMargin({
        ownerId: session.user.id,
        carrierId: carrierId || null,
        productId: productId || null,
        availableRevenue,
        at: new Date(effectiveDate),
        override: overrideMinMargin,
      });
      if (!margin.ok) {
        return NextResponse.json({ error: margin.message }, { status: 422 });
      }
    } else if (level === "OWNER") {
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
    if (session.user.role !== "ADMIN" && session.user.role !== "MARKET_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.rateSheet.findUnique({
      where: { id },
      select: { level: true, principalId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Rate sheet not found" }, { status: 404 });
    }
    if (!(await canReachSheet(session.user, existing))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.rateSheet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/rate-sheets/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
