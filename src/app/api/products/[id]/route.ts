import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/validators/common";

type RouteParams = { params: Promise<{ id: string }> };

const productInclude = {
  carrier: { select: { id: true, name: true } },
} as const;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    console.error("[GET /api/products/[id]]", error);
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
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { carrierId, name, revenue, minMarginPercent, active } = parsed.data;
    const product = await db.product.update({
      where: { id },
      data: {
        carrierId,
        name,
        revenue,
        minMarginPercent: minMarginPercent ?? null,
        active,
      },
      include: productInclude,
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("[PUT /api/products/[id]]", error);
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
    // Soft-delete: deactivate so historical sales/commissions keep their product.
    await db.product.update({ where: { id }, data: { active: false } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/products/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
