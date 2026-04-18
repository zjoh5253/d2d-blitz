import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfWeek } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const queryRepId = searchParams.get("repId");

  // Admins/managers may pass repId; otherwise scope to authenticated rep
  const role = session.user.role;
  const canQueryOthers =
    role === "ADMIN" ||
    role === "EXECUTIVE" ||
    role === "MARKET_OWNER" ||
    role === "FIELD_MANAGER";

  const repId =
    queryRepId && canQueryOthers ? queryRepId : session.user.id;

  const now = new Date();
  const startOfToday = startOfDay(now);
  const endOfToday = endOfDay(now);
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });

  // Fetch pending commissions with full detail for breakdown
  const [pendingRecords, todayResult, thisWeekResult] = await Promise.all([
    db.commissionRecord.findMany({
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
    }),
    db.commissionRecord.aggregate({
      where: {
        repId,
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
      _sum: { repPay: true },
    }),
    db.commissionRecord.aggregate({
      where: {
        repId,
        createdAt: { gte: startOfThisWeek },
      },
      _sum: { repPay: true },
    }),
  ]);

  // Group pending records by blitz for breakdown
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
    today: todayResult._sum.repPay ?? 0,
    thisWeek: thisWeekResult._sum.repPay ?? 0,
    pending: totalPending,
    pendingCount: pendingRecords.length,
    blitzBreakdown: Array.from(byBlitz.values()),
    lastSyncedAt: now.toISOString(),
  });
}
