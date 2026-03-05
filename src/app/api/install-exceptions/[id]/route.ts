import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const resolveSchema = z.object({
  resolution: z.string().min(1, "resolution is required"),
  action: z.enum(["resolve", "rematch", "reject"]).default("resolve"),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const exception = await db.installException.findUnique({ where: { id } });
    if (!exception) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { resolution, action } = parsed.data;

    // For re-match action: reset the install record to UNMATCHED
    if (action === "rematch") {
      await db.installRecord.update({
        where: { id: exception.installRecordId },
        data: { status: "UNMATCHED", matchedSaleId: null },
      });
    }

    const updated = await db.installException.update({
      where: { id },
      data: {
        resolution,
        resolvedById: session.user.id,
        resolvedAt: new Date(),
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
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/install-exceptions/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
