import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  installRecordId: z.string().min(1, "installRecordId is required"),
  saleId: z.string().optional(),
  reason: z.string().min(1, "reason is required"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved");

    const exceptions = await db.installException.findMany({
      where: {
        ...(resolved === "true"
          ? { resolvedAt: { not: null } }
          : resolved === "false"
          ? { resolvedAt: null }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        installRecord: {
          include: {
            carrier: { select: { id: true, name: true } },
          },
        },
        sale: {
          include: {
            rep: { select: { id: true, name: true } },
          },
        },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(exceptions);
  } catch (error) {
    console.error("[GET /api/install-exceptions]", error);
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

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { installRecordId, saleId, reason } = parsed.data;

    // Verify install record exists
    const record = await db.installRecord.findUnique({
      where: { id: installRecordId },
    });
    if (!record) {
      return NextResponse.json(
        { error: "Install record not found" },
        { status: 404 }
      );
    }

    const exception = await db.installException.create({
      data: {
        installRecordId,
        saleId: saleId ?? null,
        reason,
      },
      include: {
        installRecord: {
          include: {
            carrier: { select: { id: true, name: true } },
          },
        },
        sale: {
          include: {
            rep: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(exception, { status: 201 });
  } catch (error) {
    console.error("[POST /api/install-exceptions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
