import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

async function restoreHold(
  user: { id: string; role: string },
  id: string,
  allowedRoles: string[]
): Promise<NextResponse> {
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      restoredById: user.id,
    },
    include: {
      rep: { select: { id: true, name: true, email: true } },
      restoredBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    return restoreHold(session.user, id, ["ADMIN", "EXECUTIVE", "FIELD_MANAGER"]);
  } catch (error) {
    console.error("[PUT /api/compliance-holds/[id]]", error);
    captureApiError(error, "[PUT /api/compliance-holds/[id]]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    return restoreHold(session.user, id, ["ADMIN", "EXECUTIVE"]);
  } catch (error) {
    console.error("[PATCH /api/compliance-holds/[id]]", error);
    captureApiError(error, "[PATCH /api/compliance-holds/[id]]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
