import Stripe from "stripe";

// Lazy singleton so importing this module never throws at build time when the
// key is absent (mirrors getResendClient() in src/lib/email.ts). Routes call
// getStripe() at request time; a missing key surfaces a clear 500 there.
const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

export function getStripe(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!globalForStripe.stripe) {
    // apiVersion is intentionally omitted so the account default is used and the
    // pinned stripe-node types stay in sync with the installed SDK.
    globalForStripe.stripe = new Stripe(apiKey, {
      appInfo: { name: "d2d-blitz" },
      typescript: true,
    });
  }
  return globalForStripe.stripe;
}

// The origin used to build Stripe-hosted onboarding return/refresh URLs.
export function getAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}
