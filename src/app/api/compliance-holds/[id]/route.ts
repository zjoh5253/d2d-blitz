import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const hold = await db.complianceHold.findUnique({ where: { id } });
    if (!hold) {
      return NextResponse.json({ error: "Hold not found" }, { status: 404 });
    }
    if (hold.restoredDate) {
      return NextResponse.json(
        { error: "Hold is already restored" },
        { status: 409 }
      );
    }

    const updated = await db.complianceHold.update({
      where: { id },
      data: {
        restoredDate: new Date(),
        restoredById: session.user.id,
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        restoredBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/compliance-holds/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
