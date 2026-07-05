import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { syncConnectedAccount } from "@/lib/services/stripe-connect";

// GET /api/stripe/connect/status
// Return the caller's Stripe Connect onboarding/payout status. When an account
// exists we refresh capability flags from Stripe so the UI reflects reality
// after the rep returns from hosted onboarding.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connected = await db.stripeConnectedAccount.findUnique({
      where: { userId: session.user.id },
    });

    if (!connected) {
      return NextResponse.json({
        connected: false,
        onboardingStatus: "NOT_STARTED",
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    let account = connected;
    try {
      const stripe = getStripe();
      const fresh = await stripe.accounts.retrieve(connected.stripeAccountId);
      account = (await syncConnectedAccount(fresh)) ?? connected;
    } catch (refreshError) {
      // Fall back to stored flags if the refresh fails — status is still useful.
      console.error("[GET /api/stripe/connect/status] refresh failed", refreshError);
    }

    return NextResponse.json({
      connected: true,
      onboardingStatus: account.onboardingStatus,
      detailsSubmitted: account.detailsSubmitted,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
    });
  } catch (error) {
    console.error("[GET /api/stripe/connect/status]", error);
    return NextResponse.json(
      { error: "Failed to load Stripe status" },
      { status: 500 }
    );
  }
}
