/**
 * /onboarding — the FIELD_REP onboarding wizard (server component).
 *
 * Gate logic mirrors GET /api/onboarding/status and GET /api/onboarding/agreements
 * so the wizard renders with accurate initial data (no client fetch flash):
 *   - profileComplete:  rep has a non-empty phone number.
 *   - blockingComplete: every active required+blocking agreement is accepted.
 *   - gateComplete:     profileComplete AND blockingComplete (hard gate).
 *   - allComplete:      profileComplete AND every active required agreement
 *                       accepted (including non-blocking ones like the W-9).
 *
 * Redirects:
 *   - no session            → /login
 *   - non-FIELD_REP role    → /dashboard (only reps onboard)
 *   - allComplete === true  → /dashboard (nothing left to do)
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { OnboardingClient } from "./onboarding-client";
import type { OnboardingStatus, OnboardingAgreement } from "./types";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "FIELD_REP") {
    redirect("/dashboard");
  }

  const userId = session.user.id;

  const [user, agreements, acceptances] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    db.agreement.findMany({
      where: { isActive: true },
      orderBy: [{ blocking: "desc" }, { type: "asc" }],
    }),
    db.agreementAcceptance.findMany({ where: { userId } }),
  ]);

  const acceptanceByAgreementId = new Map(
    acceptances.map((a) => [a.agreementId, a])
  );

  const agreementItems: OnboardingAgreement[] = agreements.map((agreement) => {
    const acceptance = acceptanceByAgreementId.get(agreement.id);
    const accepted = !!acceptance && acceptance.version === agreement.version;
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

  const profileComplete = !!(user?.phone && user.phone.trim());

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

  if (allComplete) {
    redirect("/dashboard");
  }

  const initialStatus: OnboardingStatus = {
    profileComplete,
    blockingComplete,
    allComplete,
    gateComplete,
    agreements: agreementItems.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      required: a.required,
      blocking: a.blocking,
      requiresUpload: a.requiresUpload,
      accepted: a.accepted,
      acceptedAt: a.acceptedAt,
    })),
  };

  return (
    <OnboardingClient
      initialStatus={initialStatus}
      initialAgreements={agreementItems}
    />
  );
}
