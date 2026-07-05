import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chargebackSchema } from "@/lib/validators/common";
import { recordChargeback } from "@/lib/services/chargeback";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const chargebacks = await db.chargeback.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rep: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
        sale: { select: { id: true, customerName: true } },
      },
    });

    return NextResponse.json(chargebacks);
  } catch (error) {
    console.error("[GET /api/chargebacks]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = chargebackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const chargeback = await recordChargeback({
        saleId: parsed.data.saleId,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        actorId: session.user.id,
      });
      return NextResponse.json(chargeback, { status: 201 });
    } catch (err) {
      // Domain errors (sale not found, duplicate chargeback, bad amount) → 400.
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to record chargeback" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[POST /api/chargebacks]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
