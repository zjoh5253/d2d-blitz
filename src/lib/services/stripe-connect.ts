import type Stripe from "stripe";
import { db } from "@/lib/db";

export type OnboardingStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "ACTIVE"
  | "RESTRICTED";

/** Map a Stripe account's capability flags to our onboarding status enum. */
export function deriveOnboardingStatus(
  account: Pick<Stripe.Account, "payouts_enabled" | "details_submitted">
): OnboardingStatus {
  if (account.payouts_enabled) return "ACTIVE";
  if (account.details_submitted) return "RESTRICTED";
  return "PENDING";
}

/**
 * Persist the latest capability flags from a Stripe.Account onto our
 * StripeConnectedAccount row. Used by both the on-demand status refresh and the
 * account.updated webhook. Returns the updated row, or null if we have no row
 * for that Stripe account id (e.g. an account created outside this flow).
 */
export async function syncConnectedAccount(account: Stripe.Account) {
  const existing = await db.stripeConnectedAccount.findUnique({
    where: { stripeAccountId: account.id },
  });
  if (!existing) return null;

  return db.stripeConnectedAccount.update({
    where: { stripeAccountId: account.id },
    data: {
      detailsSubmitted: account.details_submitted ?? false,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      onboardingStatus: deriveOnboardingStatus(account),
      defaultCurrency: account.default_currency ?? existing.defaultCurrency,
    },
  });
}
