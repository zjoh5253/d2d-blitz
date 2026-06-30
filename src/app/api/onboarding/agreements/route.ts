/**
 * GET /api/onboarding/agreements
 *
 * Lists the currently active onboarding agreements together with this rep's
 * acceptance state for each one. An agreement is considered accepted only when
 * the rep has an acceptance row whose version matches the agreement's current
 * version (a version bump re-requires acceptance).
 *
 * Auth: mobile Bearer token (same JWT used by all mobile routes) via
 * getSessionFromRequest.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const [agreements, acceptances] = await Promise.all([
      db.agreement.findMany({
        where: { isActive: true },
        orderBy: [{ blocking: "desc" }, { type: "asc" }],
      }),
      db.agreementAcceptance.findMany({ where: { userId } }),
    ]);

    const acceptanceByAgreementId = new Map(
      acceptances.map((a) => [a.agreementId, a])
    );

    const items = agreements.map((agreement) => {
      const acceptance = acceptanceByAgreementId.get(agreement.id);
      const accepted =
        !!acceptance && acceptance.version === agreement.version;
      return {
        id: agreement.id,
        type: agreement.type,
        title: agreement.title,
        body: agreement.body,
        version: agreement.version,
        required: agreement.required,
        blocking: agreement.blocking,
        requiresUpload: agreement.requiresUpload,
        accepted,
        acceptedAt: accepted ? acceptance!.acceptedAt.toISOString() : null,
      };
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("[GET /api/onboarding/agreements]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
