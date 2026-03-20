import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { startOfWeek } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repId = session.user.id;
  const startOfThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [careerInstalls, userWithTier, totalEarningsResult, thisWeekEarningsResult] =
    await Promise.all([
      db.sale.count({
        where: { repId, status: "VERIFIED" },
      }),
      db.user.findUnique({
        where: { id: repId },
        select: { governanceTier: { select: { name: true } } },
      }),
      db.commissionRecord.aggregate({
        where: { repId, status: "PAID" },
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

  return NextResponse.json({
    careerInstalls,
    careerTier: userWithTier?.governanceTier?.name ?? "Unranked",
    totalEarnings: totalEarningsResult._sum.repPay ?? 0,
    thisWeekEarnings: thisWeekEarningsResult._sum.repPay ?? 0,
  });
}
