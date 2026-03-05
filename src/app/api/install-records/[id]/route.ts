import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["MATCHED", "UNMATCHED", "DISPUTED"]).optional(),
  matchedSaleId: z.string().optional(),
  action: z.enum(["confirm"]).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const record = await db.installRecord.findUnique({
      where: { id },
      include: {
        carrier: { select: { id: true, name: true } },
        matchedSale: {
          include: {
            rep: { select: { id: true, name: true } },
            carrier: { select: { id: true, name: true } },
          },
        },
        upload: { select: { id: true, fileName: true } },
        exceptions: {
          include: {
            resolvedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("[GET /api/install-records/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const record = await db.installRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { status, matchedSaleId, action } = parsed.data;

    const updateData: Record<string, unknown> = {};

    if (action === "confirm") {
      // Confirm the existing match — no status change needed, just a no-op acknowledgment
      // In a real system you might add a confirmedAt field; for now we return success
      return NextResponse.json(record);
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (matchedSaleId !== undefined) {
      // Verify the sale exists and isn't already matched
      const existingMatch = await db.installRecord.findUnique({
        where: { matchedSaleId },
      });
      if (existingMatch && existingMatch.id !== id) {
        return NextResponse.json(
          { error: "Sale is already matched to another install record" },
          { status: 409 }
        );
      }
      updateData.matchedSaleId = matchedSaleId;
      updateData.status = "MATCHED";

      // Update sale status to VERIFIED
      await db.sale.update({
        where: { id: matchedSaleId },
        data: { status: "VERIFIED" },
      });
    }

    const updated = await db.installRecord.update({
      where: { id },
      data: updateData,
      include: {
        carrier: { select: { id: true, name: true } },
        matchedSale: {
          include: {
            rep: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/install-records/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
