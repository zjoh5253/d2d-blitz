/**
 * POST /api/cron/holdback-release
 *
 * Daily job: releases retention holdbacks whose retention period has elapsed and
 * whose sale is still active (VERIFIED). Released holdbacks are paid as retention
 * bonuses in the next payout batch. Triggered by Vercel Cron; secured by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { releaseDueHoldbacks } from "@/lib/services/holdback";
import { validateCronRequest } from "@/lib/cron-auth";
import { captureApiError } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  try {
    const released = await releaseDueHoldbacks();
    const totalReleased = released.reduce((s, h) => s + h.amount, 0);

    return NextResponse.json({
      ok: true,
      releasedCount: released.length,
      totalReleased,
      message: `Released ${released.length} retention bonus(es) totaling $${totalReleased.toFixed(2)}.`,
    });
  } catch (error) {
    console.error("[cron/holdback-release]", error);
    captureApiError(error, "[cron/holdback-release]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
