import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { holdbackPolicySchema } from "@/lib/validators/common";

type RouteParams = { params: Promise<{ id: string }> };

const policyInclude = {
  carrier: { select: { id: true, name: true } },
} as const;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const policy = await db.holdbackPolicy.findUnique({
      where: { id },
      include: policyInclude,
    });

    if (!policy) {
      return NextResponse.json({ error: "Holdback policy not found" }, { status: 404 });
    }

    return NextResponse.json(policy);
  } catch (error) {
    console.error("[GET /api/holdback-policies/[id]]", error);
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
    const parsed = holdbackPolicySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { carrierId, holdbackPercent, holdbackDays, effectiveDate } = parsed.data;

    const policy = await db.holdbackPolicy.update({
      where: { id },
      data: {
        carrierId: carrierId || null,
        holdbackPercent,
        holdbackDays,
        effectiveDate: new Date(effectiveDate),
      },
      include: policyInclude,
    });

    return NextResponse.json(policy);
  } catch (error) {
    console.error("[PUT /api/holdback-policies/[id]]", error);
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
    await db.holdbackPolicy.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/holdback-policies/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
