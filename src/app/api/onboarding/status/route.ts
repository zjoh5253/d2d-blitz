/**
 * GET /api/onboarding/status
 *
 * Computes the rep's onboarding gate state used by the mobile app to decide
 * whether to block access. Combines profile completeness (a phone number is
 * required) with acceptance of the active agreements.
 *
 *   - profileComplete:  rep has a non-empty phone number.
 *   - blockingComplete: every active required+blocking agreement is accepted
 *                       (this is what hard-gates app access).
 *   - allComplete:      profile complete AND every active required agreement
 *                       accepted (including non-blocking ones like the W-9).
 *   - gateComplete:     profile complete AND blockingComplete.
 *
 * Auth: mobile Bearer token via getSessionFromRequest.
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
    const [user, agreements, acceptances] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      }),
      db.agreement.findMany({
        where: { isActive: true },
        orderBy: [{ blocking: "desc" }, { type: "asc" }],
      }),
      db.agreementAcceptance.findMany({ where: { userId } }),
    ]);

    const profileComplete = !!(user?.phone && user.phone.trim());

    const acceptanceByAgreementId = new Map(
      acceptances.map((a) => [a.agreementId, a])
    );

    const agreementStates = agreements.map((agreement) => {
      const acceptance = acceptanceByAgreementId.get(agreement.id);
      const accepted =
        !!acceptance && acceptance.version === agreement.version;
      return {
        id: agreement.id,
        type: agreement.type,
        title: agreement.title,
        required: agreement.required,
        blocking: agreement.blocking,
        requiresUpload: agreement.requiresUpload,
        accepted,
        acceptedAt: accepted ? acceptance!.acceptedAt.toISOString() : null,
      };
    });

    const blockingComplete = agreements.every((agreement) => {
      if (!(agreement.required && agreement.blocking)) return true;
      const acceptance = acceptanceByAgreementId.get(agreement.id);
      return !!acceptance && acceptance.version === agreement.version;
    });

    const allAgreementsAccepted = agreements.every((agreement) => {
      if (!agreement.required) return true;
      const acceptance = acceptanceByAgreementId.get(agreement.id);
      return !!acceptance && acceptance.version === agreement.version;
    });

    const allComplete = profileComplete && allAgreementsAccepted;
    const gateComplete = profileComplete && blockingComplete;

    return NextResponse.json({
      profileComplete,
      blockingComplete,
      allComplete,
      gateComplete,
      agreements: agreementStates,
    });
  } catch (error) {
    console.error("[GET /api/onboarding/status]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
