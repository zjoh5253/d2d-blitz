import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repId = session.user.id;

  // Fetch pending (ELIGIBLE + PENDING) commission records for this rep
  const pendingRecords = await db.commissionRecord.findMany({
    where: {
      repId,
      status: { in: ["ELIGIBLE", "PENDING"] },
    },
    include: {
      blitz: { select: { id: true, name: true } },
      sale: {
        select: {
          id: true,
          customerName: true,
          submittedAt: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Find the current open payout batch to surface the close date
  const currentBatch = await db.payoutBatch.findFirst({
    where: { status: { in: ["DRAFT", "REVIEWED"] } },
    orderBy: { createdAt: "desc" },
    select: { period: true, slaDeadline: true },
  });

  // Group by blitz for breakdown
  const byBlitz = new Map<
    string,
    {
      blitzId: string;
      blitzName: string;
      totalPending: number;
      lineItems: Array<{
        commissionId: string;
        saleId: string;
        customerName: string;
        submittedAt: string;
        saleStatus: string;
        repPay: number;
      }>;
    }
  >();

  for (const record of pendingRecords) {
    const key = record.blitzId;
    if (!byBlitz.has(key)) {
      byBlitz.set(key, {
        blitzId: record.blitzId,
        blitzName: record.blitz.name,
        totalPending: 0,
        lineItems: [],
      });
    }
    const entry = byBlitz.get(key)!;
    entry.totalPending += record.repPay;
    entry.lineItems.push({
      commissionId: record.id,
      saleId: record.saleId,
      customerName: record.sale.customerName,
      submittedAt: record.sale.submittedAt.toISOString(),
      saleStatus: record.sale.status,
      repPay: record.repPay,
    });
  }

  const totalPending = pendingRecords.reduce((sum, r) => sum + r.repPay, 0);

  return NextResponse.json({
    isPreview: true,
    repId,
    pending: totalPending,
    pendingCount: pendingRecords.length,
    currentPeriod: currentBatch?.period ?? null,
    batchClosesAt: currentBatch?.slaDeadline?.toISOString() ?? null,
    blitzBreakdown: Array.from(byBlitz.values()),
    lastSyncedAt: new Date().toISOString(),
  });
}
