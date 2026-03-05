import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { carrierSchema } from "@/lib/validators/common";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const carrier = await db.carrier.findUnique({ where: { id } });

    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json(carrier);
  } catch (error) {
    console.error("[GET /api/carriers/[id]]", error);
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
    const parsed = carrierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, revenuePerInstall, portalUrl, status } = parsed.data;

    const carrier = await db.carrier.update({
      where: { id },
      data: {
        name,
        revenuePerInstall,
        portalUrl: portalUrl || null,
        status,
      },
    });

    return NextResponse.json(carrier);
  } catch (error) {
    console.error("[PUT /api/carriers/[id]]", error);
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

    // Soft delete by setting status to INACTIVE
    const carrier = await db.carrier.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    return NextResponse.json(carrier);
  } catch (error) {
    console.error("[DELETE /api/carriers/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
