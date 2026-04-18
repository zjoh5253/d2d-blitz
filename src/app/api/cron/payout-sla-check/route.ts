/**
 * POST /api/cron/payout-sla-check
 *
 * Runs hourly: alerts Admin/Executive users when a payout batch has exceeded
 * the 2-business-day approval SLA. Only alerts once per batch.
 *
 * Triggered by Vercel Cron (see vercel.json). Secured by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPayoutBatchSLA } from "@/lib/services/payout";
import { sendPayoutSLAAlertEmail } from "@/lib/email";
import { validateCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  try {
    const alertedBatchIds = await checkPayoutBatchSLA();

    if (alertedBatchIds.length === 0) {
      return NextResponse.json({ ok: true, message: "No SLA breaches found." });
    }

    // Fetch details for alerted batches
    const batches = await db.payoutBatch.findMany({
      where: { id: { in: alertedBatchIds } },
      include: { payoutLines: true },
    });

    // Notify admins
    const admins = await db.user.findMany({
      where: { role: { in: ["ADMIN", "EXECUTIVE"] } },
      select: { email: true, name: true },
    });

    for (const batch of batches) {
      const totalPayout = batch.payoutLines.reduce((s, l) => s + l.netPay, 0);
      for (const admin of admins) {
        if (admin.email) {
          try {
            await sendPayoutSLAAlertEmail({
              to: admin.email,
              recipientName: admin.name ?? "Admin",
              batchId: batch.id,
              period: batch.period,
              totalPayout,
              slaDeadline: batch.slaDeadline ?? new Date(),
              currentStatus: batch.status,
            });
          } catch (err) {
            console.error(`[cron/payout-sla-check] Email failed for ${admin.email}:`, err);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      alertedBatchIds,
      message: `SLA alerts sent for ${alertedBatchIds.length} batch(es).`,
    });
  } catch (error) {
    console.error("[cron/payout-sla-check]", error);
    return NextResponse.json(
      { error: "Internal server error", detail: String(error) },
      { status: 500 }
    );
  }
}
