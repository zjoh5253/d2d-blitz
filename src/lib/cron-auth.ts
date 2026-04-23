import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the Authorization header against CRON_SECRET for Vercel Cron routes.
 *
 * Returns a 401 response if the secret is missing or does not match.
 * Returns a 500 response if CRON_SECRET is not configured (misconfiguration guard —
 * prevents "Bearer undefined" from becoming an accidentally valid token).
 *
 * Usage:
 *   const authError = validateCronRequest(request);
 *   if (authError) return authError;
 */
export function validateCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron-auth] CRON_SECRET environment variable is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: cron secret not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
