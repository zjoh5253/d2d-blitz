import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { repCommissionOverrideSchema } from "@/lib/validators/common";

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
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const overrides = await db.repCommissionOverride.findMany({
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
    if (session.user.role !== "ADMIN") {
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

    const { repId, carrierId, productId, amount, effectiveDate, active } = parsed.data;

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
