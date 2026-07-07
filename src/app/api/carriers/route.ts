import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { carrierSchema } from "@/lib/validators/common";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
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
    const session = await getSessionFromRequest(request);
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

    const { name, revenuePerInstall, minMarginPercent, portalUrl, status } = parsed.data;

    const carrier = await db.carrier.create({
      data: {
        name,
        revenuePerInstall,
        minMarginPercent,
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
