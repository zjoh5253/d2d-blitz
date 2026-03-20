import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfWeek } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repId = session.user.id;
  const now = new Date();
  const startOfToday = startOfDay(now);
  const endOfToday = endOfDay(now);
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });

  const [todayResult, thisWeekResult, pendingResult] = await Promise.all([
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
    db.commissionRecord.aggregate({
      where: {
        repId,
        status: { in: ["ELIGIBLE", "PENDING"] },
      },
      _sum: { repPay: true },
    }),
  ]);

  return NextResponse.json({
    today: todayResult._sum.repPay ?? 0,
    thisWeek: thisWeekResult._sum.repPay ?? 0,
    pending: pendingResult._sum.repPay ?? 0,
  });
}
