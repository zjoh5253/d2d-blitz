/**
 * POST /api/cron/payout-batch
 *
 * Nightly job: creates a payout batch for all ELIGIBLE commissions in newly-closed blitzes.
 * Triggered by Vercel Cron (see vercel.json). Secured by CRON_SECRET.
 *
 * On success, emails Admin/Executive users a summary and audit link.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPayoutBatch } from "@/lib/services/payout";
import { sendPayoutBatchCreatedEmail } from "@/lib/email";
import { validateCronRequest } from "@/lib/cron-auth";
import { captureApiError } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  try {
    // Check for eligible commissions (those in CLOSED blitzes without a batch)
    const eligibleCount = await db.commissionRecord.count({
      where: { status: "ELIGIBLE" },
    });

    if (eligibleCount === 0) {
      return NextResponse.json({
        ok: true,
        message: "No eligible commissions found. No batch created.",
        batchId: null,
      });
    }

    // Use ISO date as the period identifier (YYYY-MM-DD)
    const period = new Date().toISOString().slice(0, 10);

    // Guard: don't create a duplicate batch for the same period
    const existing = await db.payoutBatch.findFirst({
      where: { period, status: { in: ["DRAFT", "REVIEWED", "APPROVED"] } },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        message: `Batch for period ${period} already exists (${existing.status}).`,
        batchId: existing.id,
      });
    }

    const batch = await createPayoutBatch(period);

    // Fetch full batch for email summary
    const fullBatch = await db.payoutBatch.findUnique({
      where: { id: batch.id },
      include: {
        payoutLines: {
          include: { rep: { select: { id: true, name: true } } },
          orderBy: { netPay: "desc" },
        },
      },
    });

    if (!fullBatch) throw new Error("Batch not found after creation");

    const totalPayout = fullBatch.payoutLines.reduce((s, l) => s + l.netPay, 0);

    // Notify all Admin/Executive users
    const admins = await db.user.findMany({
      where: { role: { in: ["ADMIN", "EXECUTIVE"] } },
      select: { email: true, name: true },
    });

    for (const admin of admins) {
      if (admin.email) {
        try {
          await sendPayoutBatchCreatedEmail({
            to: admin.email,
            recipientName: admin.name ?? "Admin",
            batchId: fullBatch.id,
            period,
            repCount: fullBatch.payoutLines.length,
            totalPayout,
            reconciliationRate: fullBatch.reconciliationRate,
            matchedInstalls: fullBatch.matchedInstalls,
            totalInstalls: fullBatch.totalInstalls,
            slaDeadline: fullBatch.slaDeadline ?? new Date(),
          });
        } catch (err) {
          console.error(`[cron/payout-batch] Email failed for ${admin.email}:`, err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Batch created for period ${period}.`,
      batchId: fullBatch.id,
      repCount: fullBatch.payoutLines.length,
      totalPayout,
      reconciliationRate: fullBatch.reconciliationRate,
    });
  } catch (error) {
    console.error("[cron/payout-batch]", error);
    captureApiError(error, "[cron/payout-batch]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
