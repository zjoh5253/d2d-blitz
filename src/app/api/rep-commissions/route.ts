import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { repCommissionOverrideSchema } from "@/lib/validators/common";
import { checkRepPayMargin } from "@/lib/services/min-margin";
import { getPayrollScope } from "@/lib/services/payroll-scope";

const overrideInclude = {
  rep: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
} as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role } = session.user;
    if (role !== "ADMIN" && role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // A FIELD_MANAGER sees only the overrides of their downline reps.
    const where =
      role === "FIELD_MANAGER"
        ? { repId: { in: (await getPayrollScope(session.user)).repIds } }
        : undefined;

    const overrides = await db.repCommissionOverride.findMany({
      where,
      orderBy: [{ repId: "asc" }, { effectiveDate: "desc" }],
      include: overrideInclude,
    });

    return NextResponse.json(overrides);
  } catch (error) {
    console.error("[GET /api/rep-commissions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role } = session.user;
    if (role !== "ADMIN" && role !== "FIELD_MANAGER") {
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

    if (role === "FIELD_MANAGER") {
      // A manager may only set pay for their downline reps, capped at their own
      // available revenue (blind to upstream).
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

    const override = await db.repCommissionOverride.create({
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

    return NextResponse.json(override, { status: 201 });
  } catch (error) {
    console.error("[POST /api/rep-commissions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
