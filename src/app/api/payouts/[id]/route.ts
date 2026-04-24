import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { captureServerEvent } from "@/lib/posthog";
import {
  reviewPayoutBatch,
  approvePayoutBatch,
  markPayoutBatchPaid,
} from "@/lib/services/payout";

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
        auditLogs: {
          orderBy: { createdAt: "asc" },
        },
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

    let updated;
    try {
      if (newStatus === "REVIEWED") {
        updated = await reviewPayoutBatch(id, session.user.id);
      } else if (newStatus === "APPROVED") {
        updated = await approvePayoutBatch(id, session.user.id);
      } else if (newStatus === "PAID") {
        updated = await markPayoutBatchPaid(id);
      } else {
        return NextResponse.json(
          { error: `Transition to ${newStatus} is not supported` },
          { status: 409 }
        );
      }
    } catch (serviceError) {
      const message =
        serviceError instanceof Error
          ? serviceError.message
          : "Service error";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (newStatus === "APPROVED") {
      const lines = await db.payoutLine.findMany({
        where: { batchId: id },
        select: { id: true },
      });
      captureServerEvent(session.user.id, "payout_approved", {
        batch_id: id,
        payout_lines: lines.length,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/payouts/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
