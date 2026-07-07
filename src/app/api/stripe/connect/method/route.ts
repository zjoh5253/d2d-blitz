import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  method: z.enum(["STANDARD", "INSTANT"]),
});

// PATCH /api/stripe/connect/method — set the caller's payout method preference
// (Standard ACH vs Instant Payout to debit). Requires a connected account.
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const account = await db.stripeConnectedAccount.findUnique({
      where: { userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Connect a payout account first." },
        { status: 400 }
      );
    }

    const updated = await db.stripeConnectedAccount.update({
      where: { userId: session.user.id },
      data: { payoutMethod: parsed.data.method },
    });

    return NextResponse.json({ payoutMethod: updated.payoutMethod });
  } catch (error) {
    console.error("[PATCH /api/stripe/connect/method]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
