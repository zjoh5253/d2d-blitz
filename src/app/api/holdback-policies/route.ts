import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { holdbackPolicySchema } from "@/lib/validators/common";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const policies = await db.holdbackPolicy.findMany({
      orderBy: [{ carrierId: "asc" }, { effectiveDate: "desc" }],
      include: {
        carrier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(policies);
  } catch (error) {
    console.error("[GET /api/holdback-policies]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    const parsed = holdbackPolicySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { carrierId, holdbackPercent, holdbackDays, effectiveDate } = parsed.data;

    const policy = await db.holdbackPolicy.create({
      data: {
        carrierId: carrierId || null,
        holdbackPercent,
        holdbackDays,
        effectiveDate: new Date(effectiveDate),
      },
      include: {
        carrier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    console.error("[POST /api/holdback-policies]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
