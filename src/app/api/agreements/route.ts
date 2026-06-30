import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agreementSchema } from "@/lib/validators/common";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreements = await db.agreement.findMany({
      orderBy: [{ type: "asc" }, { version: "desc" }],
    });

    return NextResponse.json(agreements);
  } catch (error) {
    console.error("[GET /api/agreements]", error);
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
    const parsed = agreementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, title, body: agreementBody, version, required, blocking, requiresUpload, isActive } = parsed.data;

    const agreement = await db.agreement.create({
      data: {
        type,
        title,
        body: agreementBody,
        version,
        required,
        blocking,
        requiresUpload,
        isActive,
      },
    });

    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    console.error("[POST /api/agreements]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
