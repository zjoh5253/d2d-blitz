import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { syncConnectedAccount } from "@/lib/services/stripe-connect";

// Stripe needs the raw request body to verify the signature, so this route must
// not parse JSON first. It is public (not behind the dashboard auth middleware,
// whose matcher only covers /dashboard, /login, /register) and is gated solely
// by the Stripe signature check below.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[stripe webhook] signature verification failed:", detail);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "account.updated": {
        await syncConnectedAccount(event.data.object as Stripe.Account);
        break;
      }
      case "transfer.reversed": {
        const transfer = event.data.object as Stripe.Transfer;
        await db.payoutTransfer.updateMany({
          where: { stripeTransferId: transfer.id },
          data: { status: "REVERSED" },
        });
        break;
      }
      case "transfer.created":
      case "transfer.updated": {
        const transfer = event.data.object as Stripe.Transfer;
        // Confirm the transfer landed; only touch rows we created.
        await db.payoutTransfer.updateMany({
          where: { stripeTransferId: transfer.id, status: { not: "REVERSED" } },
          data: { status: "PAID" },
        });
        break;
      }
      default:
        // Unhandled event types are acknowledged and ignored.
        break;
    }
  } catch (error) {
    console.error(`[stripe webhook] handler error for ${event.type}:`, error);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
