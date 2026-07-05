import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { captureServerEvent } from "@/lib/posthog";
import { payBatchViaStripe } from "@/lib/services/stripe-payout";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["REVIEWED"],
  REVIEWED: ["APPROVED"],
  APPROVED: ["PAID"],
  // PAID -> PAID is allowed as an idempotent retry: reps who onboard to Stripe
  // after the first run can still be paid (transfers are keyed by payout line).
  PAID: ["PAID"],
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

    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Move real money via Stripe BEFORE flipping commission records, so only reps
    // who were actually paid are marked PAID. Reps who can't be paid yet (not
    // onboarded, on compliance hold, zero net) are reported back, not dropped.
    let stripeResult: Awaited<ReturnType<typeof payBatchViaStripe>> | undefined;
    if (newStatus === "PAID") {
      stripeResult = await payBatchViaStripe(id);

      const paidRepIds = [
        ...stripeResult.transferred.map((t) => t.repId),
        ...stripeResult.skipped
          .filter((s) => s.reason === "already_transferred")
          .map((s) => s.repId),
      ];

      if (paidRepIds.length > 0) {
        await db.commissionRecord.updateMany({
          where: { repId: { in: paidRepIds }, status: "PENDING" },
          data: { status: "PAID" },
        });
      }
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

    if (newStatus === "APPROVED") {
      captureServerEvent(session.user.id, "payout_approved", {
        batch_id: id,
        payout_lines: updated.payoutLines.length,
      })
    }

    if (newStatus === "PAID" && stripeResult) {
      captureServerEvent(session.user.id, "payout_paid", {
        batch_id: id,
        transferred: stripeResult.transferred.length,
        skipped: stripeResult.skipped.length,
      });
    }

    return NextResponse.json(
      stripeResult ? { ...updated, stripeResult } : updated
    );
  } catch (error) {
    console.error("[PUT /api/payouts/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
