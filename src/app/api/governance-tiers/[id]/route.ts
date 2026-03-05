import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { governanceTierSchema } from "@/lib/validators/common";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tier = await db.governanceTier.findUnique({ where: { id } });

    if (!tier) {
      return NextResponse.json(
        { error: "Governance tier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(tier);
  } catch (error) {
    console.error("[GET /api/governance-tiers/[id]]", error);
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
    const parsed = governanceTierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, rank, minInstallRate, commissionMultiplier, isDefault } =
      parsed.data;

    // If this is set as default, unset any other defaults
    if (isDefault) {
      await db.governanceTier.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const tier = await db.governanceTier.update({
      where: { id },
      data: {
        name,
        rank,
        minInstallRate,
        commissionMultiplier,
        isDefault,
      },
    });

    return NextResponse.json(tier);
  } catch (error) {
    console.error("[PUT /api/governance-tiers/[id]]", error);
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

    // Check for users assigned to this tier
    const usersCount = await db.user.count({
      where: { governanceTierId: id },
    });

    if (usersCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete tier with ${usersCount} assigned user(s). Reassign users first.`,
        },
        { status: 409 }
      );
    }

    await db.governanceTier.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/governance-tiers/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
