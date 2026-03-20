import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { calculateStreak } from "@/lib/services/streak";
import { subDays } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repId = session.user.id;
  const since = subDays(new Date(), 365);

  const sales = await db.sale.findMany({
    where: {
      repId,
      status: "VERIFIED",
      submittedAt: { gte: since },
    },
    select: { submittedAt: true },
    orderBy: { submittedAt: "desc" },
  });

  const dates = sales.map((s) => s.submittedAt);
  const result = calculateStreak(dates);

  return NextResponse.json(result);
}
