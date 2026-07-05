import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional ?carrierId= filter (used by the sale form / stack form).
    const carrierId = request.nextUrl.searchParams.get("carrierId") ?? undefined;
    const activeOnly = request.nextUrl.searchParams.get("active") === "true";

    const products = await db.product.findMany({
      where: {
        ...(carrierId ? { carrierId } : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: [{ carrierId: "asc" }, { name: "asc" }],
      include: { carrier: { select: { id: true, name: true } } },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("[GET /api/products]", error);
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
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { carrierId, name, revenue, minMarginPercent, active } = parsed.data;

    const product = await db.product.create({
      data: {
        carrierId,
        name,
        revenue,
        minMarginPercent: minMarginPercent ?? null,
        active,
      },
      include: { carrier: { select: { id: true, name: true } } },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("[POST /api/products]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
