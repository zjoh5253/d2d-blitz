import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createBatchSchema = z.object({
  period: z.string().min(1, "period is required"),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const batches = await db.payoutBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: { select: { id: true, name: true } },
        payoutLines: {
          select: {
            id: true,
            repId: true,
            grossPay: true,
            totalDeductions: true,
            netPay: true,
            complianceVerified: true,
            governanceChecked: true,
          },
        },
      },
    });

    return NextResponse.json(batches);
  } catch (error) {
    console.error("[GET /api/payouts]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
    const parsed = createBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { period } = parsed.data;

    // Get all ELIGIBLE commission records not yet in a payout
    const eligibleCommissions = await db.commissionRecord.findMany({
      where: {
        status: "ELIGIBLE",
      },
      include: {
        rep: {
          include: {
            deductions: {
              select: { amount: true, repId: true },
            },
          },
        },
      },
    });

    if (eligibleCommissions.length === 0) {
      return NextResponse.json(
        { error: "No eligible commission records found" },
        { status: 400 }
      );
    }

    // Group by rep
    const byRep = eligibleCommissions.reduce<
      Record<string, typeof eligibleCommissions>
    >((acc, c) => {
      if (!acc[c.repId]) acc[c.repId] = [];
      acc[c.repId].push(c);
      return acc;
    }, {});

    // Create batch
    const batch = await db.payoutBatch.create({
      data: {
        period,
        status: "DRAFT",
        payoutLines: {
          create: Object.entries(byRep).map(([repId, commissions]) => {
            const grossPay = commissions.reduce((s, c) => s + c.repPay, 0);
            // Sum unpaid deductions for this rep
            const repDeductions = commissions[0].rep.deductions;
            const totalDeductions = repDeductions.reduce((s, d) => s + d.amount, 0);
            const netPay = Math.max(0, grossPay - totalDeductions);

            return {
              repId,
              grossPay,
              totalDeductions,
              netPay,
              complianceVerified: false,
              governanceChecked: false,
            };
          }),
        },
      },
      include: {
        payoutLines: {
          include: {
            rep: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Mark commission records as PENDING
    await db.commissionRecord.updateMany({
      where: { repId: { in: Object.keys(byRep) }, status: "ELIGIBLE" },
      data: { status: "PENDING" },
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error("[POST /api/payouts]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
