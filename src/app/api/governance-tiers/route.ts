import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { governanceTierSchema } from "@/lib/validators/common";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tiers = await db.governanceTier.findMany({
      orderBy: { rank: "asc" },
    });

    return NextResponse.json(tiers);
  } catch (error) {
    console.error("[GET /api/governance-tiers]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
    const parsed = governanceTierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, rank, minInstallRate, commissionMultiplier, isDefault } =
      parsed.data;

    // If this is set as default, unset any existing default
    if (isDefault) {
      await db.governanceTier.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const tier = await db.governanceTier.create({
      data: {
        name,
        rank,
        minInstallRate,
        commissionMultiplier,
        isDefault,
      },
    });

    return NextResponse.json(tier, { status: 201 });
  } catch (error) {
    console.error("[POST /api/governance-tiers]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
