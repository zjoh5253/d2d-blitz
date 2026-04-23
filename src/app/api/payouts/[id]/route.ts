import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  reviewPayoutBatch,
  approvePayoutBatch,
  markPayoutBatchPaid,
} from "@/lib/services/payout";

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
          include: { rep: { select: { id: true, name: true } } },
          orderBy: { netPay: "desc" },
        },
        auditLogs: {
          include: { performedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(batch);
  } catch (error) {
    console.error("[GET /api/payouts/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    // Delegate to service layer which enforces reconciliation and writes audit log
    try {
      if (newStatus === "REVIEWED") {
        await reviewPayoutBatch(id, session.user.id);
      } else if (newStatus === "APPROVED") {
        await approvePayoutBatch(id, session.user.id);
      } else if (newStatus === "PAID") {
        await markPayoutBatchPaid(id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 422 });
    }

    // Return full batch with audit log
    const result = await db.payoutBatch.findUnique({
      where: { id },
      include: {
        approvedBy: { select: { id: true, name: true } },
        payoutLines: {
          include: { rep: { select: { id: true, name: true } } },
          orderBy: { netPay: "desc" },
        },
        auditLogs: {
          include: { performedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[PUT /api/payouts/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
