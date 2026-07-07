import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe, getAppOrigin } from "@/lib/stripe";

// POST /api/stripe/connect/onboard
// Create-or-fetch the caller's Stripe Connect Express account and return a
// Stripe-hosted onboarding link. Stripe collects the rep's bank/debit + KYC; we
// only ever store the account id and Stripe's capability flags.
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = getStripe();
    const userId = session.user.id;

    let connected = await db.stripeConnectedAccount.findUnique({
      where: { userId },
    });

    if (!connected) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      const account = await stripe.accounts.create({
        type: "express",
        email: user?.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { userId },
      });

      connected = await db.stripeConnectedAccount.create({
        data: {
          userId,
          stripeAccountId: account.id,
          onboardingStatus: "PENDING",
          defaultCurrency: account.default_currency ?? "usd",
        },
      });
    }

    const origin = getAppOrigin();
    const accountLink = await stripe.accountLinks.create({
      account: connected.stripeAccountId,
      refresh_url: `${origin}/dashboard/payments?refresh=1`,
      return_url: `${origin}/dashboard/payments?done=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[POST /api/stripe/connect/onboard]", error);
    return NextResponse.json(
      { error: "Failed to start Stripe onboarding" },
      { status: 500 }
    );
  }
}
