import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["REVIEWED"],
  REVIEWED: ["APPROVED"],
  APPROVED: ["PAID"],
  PAID: [],
};

const updateSchema = z.object({
  status: z.enum(["DRAFT", "REVIEWED", "APPROVED", "PAID"]),
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

    const batch = await db.payoutBatch.findUnique({
      where: { id },
      include: {
        approvedBy: { select: { id: true, name: true } },
        payoutLines: {
          include: {
            rep: { select: { id: true, name: true } },
          },
          orderBy: { netPay: "desc" },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(batch);
  } catch (error) {
    console.error("[GET /api/payouts/[id]]", error);
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

    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const { status: newStatus } = parsed.data;

    const batch = await db.payoutBatch.findUnique({ where: { id } });
    if (!batch) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const allowed = STATUS_TRANSITIONS[batch.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${batch.status} to ${newStatus}. Allowed: ${allowed.join(", ") || "none"}`,
        },
        { status: 409 }
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "APPROVED") {
      updateData.approvedById = session.user.id;
      updateData.approvedAt = new Date();
    }

    if (newStatus === "PAID") {
      // Mark all PENDING commission records for reps in this batch as PAID
      const lines = await db.payoutLine.findMany({
        where: { batchId: id },
        select: { repId: true },
      });
      const repIds = lines.map((l) => l.repId);
      await db.commissionRecord.updateMany({
        where: { repId: { in: repIds }, status: "PENDING" },
        data: { status: "PAID" },
      });
    }

    const updated = await db.payoutBatch.update({
      where: { id },
      data: updateData,
      include: {
        approvedBy: { select: { id: true, name: true } },
        payoutLines: {
          include: {
            rep: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/payouts/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
