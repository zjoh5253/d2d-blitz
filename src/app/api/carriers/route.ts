import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { carrierSchema } from "@/lib/validators/common";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const carriers = await db.carrier.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(carriers);
  } catch (error) {
    console.error("[GET /api/carriers]", error);
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
    const parsed = carrierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, revenuePerInstall, portalUrl, status } = parsed.data;

    const carrier = await db.carrier.create({
      data: {
        name,
        revenuePerInstall,
        portalUrl: portalUrl || null,
        status,
      },
    });

    return NextResponse.json(carrier, { status: 201 });
  } catch (error) {
    console.error("[POST /api/carriers]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
