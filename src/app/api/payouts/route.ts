import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { captureApiError } from "@/lib/sentry";
import { createPayoutBatch } from "@/lib/services/payout";
import { getPayrollScope } from "@/lib/services/payroll-scope";

const ADMIN_ROLES = ["ADMIN", "EXECUTIVE"];
const MANAGER_ROLES = ["FIELD_MANAGER", "MARKET_OWNER"];

const createBatchSchema = z.object({
  period: z.string().min(1).optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = ADMIN_ROLES.includes(session.user.role);
    const isManager = MANAGER_ROLES.includes(session.user.role);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const batches = await db.payoutBatch.findMany({
      // Managers see only the runs they initiated; admins see everything.
      where: isAdmin ? {} : { initiatedById: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: { select: { id: true, name: true } },
        initiatedBy: { select: { id: true, name: true } },
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
    captureApiError(error, "[GET /api/payouts]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = ADMIN_ROLES.includes(session.user.role);
    const isManager = MANAGER_ROLES.includes(session.user.role);
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    let period: string;
    let opts: Parameters<typeof createPayoutBatch>[1];

    if (isManager) {
      // Manager-initiated: scope to the manager's downline, namespace the period
      // (period is globally unique), and record who initiated it. Admins approve/pay.
      const scope = await getPayrollScope(session.user);
      period = parsed.data.period ?? `${today}:${session.user.id}`;
      opts = { initiatedById: session.user.id, scopeRepIds: scope.repIds };
    } else {
      period = parsed.data.period ?? today;
      opts = {};
    }

    // Guard against a duplicate batch for the same period.
    const existing = await db.payoutBatch.findUnique({ where: { period } });
    if (existing) {
      return NextResponse.json(
        { error: `A payout batch for period "${period}" already exists.` },
        { status: 409 }
      );
    }

    let batch;
    try {
      batch = await createPayoutBatch(period, opts);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("No eligible payouts")) {
        return NextResponse.json(
          { error: "No eligible payouts found for this run." },
          { status: 400 }
        );
      }
      throw err;
    }

    const full = await db.payoutBatch.findUnique({
      where: { id: batch.id },
      include: {
        payoutLines: { include: { rep: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    console.error("[POST /api/payouts]", error);
    captureApiError(error, "[POST /api/payouts]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
