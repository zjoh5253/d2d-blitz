import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { repCommissionOverrideSchema } from "@/lib/validators/common";
import { checkRepPayMargin } from "@/lib/services/min-margin";
import { getPayrollScope } from "@/lib/services/payroll-scope";

type RouteParams = { params: Promise<{ id: string }> };

const overrideInclude = {
  rep: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
} as const;

/**
 * A FIELD_MANAGER may only reach an override for one of their downline reps.
 * Returns true for ADMIN, or for a manager whose downline includes the rep.
 */
async function canReachOverride(
  user: { id: string; role: string },
  override: { repId: string }
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "FIELD_MANAGER") return false;
  const { repIds } = await getPayrollScope(user);
  return repIds.includes(override.repId);
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
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
    if (!(await canReachOverride(session.user, override))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Guard the record being edited (a manager can't touch out-of-scope reps).
    const existing = await db.repCommissionOverride.findUnique({
      where: { id },
      select: { repId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }
    if (!(await canReachOverride(session.user, existing))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = repCommissionOverrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { repId, carrierId, productId, amount, effectiveDate, active, overrideMinMargin } =
      parsed.data;

    if (session.user.role === "FIELD_MANAGER") {
      // The new target rep must also stay in-scope, capped at manager revenue.
      const { repIds } = await getPayrollScope(session.user);
      if (!repIds.includes(repId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const margin = await checkRepPayMargin({
        managerId: session.user.id,
        carrierId: carrierId || null,
        productId: productId || null,
        amount,
        at: new Date(effectiveDate),
        override: overrideMinMargin,
      });
      if (!margin.ok) {
        return NextResponse.json({ error: margin.message }, { status: 422 });
      }
    }

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
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.repCommissionOverride.findUnique({
      where: { id },
      select: { repId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }
    if (!(await canReachOverride(session.user, existing))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.repCommissionOverride.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/rep-commissions/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
