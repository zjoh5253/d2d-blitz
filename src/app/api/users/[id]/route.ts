import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userEditSchema } from "@/lib/validators/common";

type RouteParams = { params: Promise<{ id: string }> };

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  governanceTierId: true,
  createdAt: true,
  updatedAt: true,
  governanceTier: {
    select: { id: true, name: true },
  },
} as const;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const user = await db.user.findUnique({ where: { id }, select: userSelect });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[GET /api/users/[id]]", error);
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
    const parsed = userEditSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone, role, status } = parsed.data;

    const user = await db.user.update({
      where: { id },
      data: {
        name,
        email,
        phone: phone || null,
        role,
        status,
      },
      select: userSelect,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("[PUT /api/users/[id]]", error);
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
    const user = await db.user.update({
      where: { id },
      data: { status: "INACTIVE" },
      select: userSelect,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("[DELETE /api/users/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
