import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leads = await db.lead.findMany({
      include: {
        interviews: {
          orderBy: { date: "asc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Find users who were onboarded (came from leads)
    const onboardedUsers = await db.user.findMany({
      where: { role: "FIELD_REP" },
      select: {
        id: true,
        createdAt: true,
        sales: {
          orderBy: { submittedAt: "asc" },
          take: 1,
          select: { submittedAt: true },
        },
      },
    });

    const totalLeads = leads.length;
    const onboarded = leads.filter((l) => l.status === "ONBOARDED").length;
    const conversionRate =
      totalLeads > 0 ? Math.round((onboarded / totalLeads) * 100) : 0;

    // By source breakdown
    const sourceMap = new Map<
      string,
      { leads: number; onboarded: number; totalDaysToOnboard: number; count: number }
    >();

    for (const lead of leads) {
      const source = lead.source;
      const existing = sourceMap.get(source) ?? {
        leads: 0,
        onboarded: 0,
        totalDaysToOnboard: 0,
        count: 0,
      };
      existing.leads++;
      if (lead.status === "ONBOARDED") {
        existing.onboarded++;
        if (lead.interviews[0]) {
          const days = Math.round(
            (lead.interviews[0].date.getTime() - lead.createdAt.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          existing.totalDaysToOnboard += days;
          existing.count++;
        }
      }
      sourceMap.set(source, existing);
    }

    const bySource = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      leads: data.leads,
      onboarded: data.onboarded,
      conversionPercent:
        data.leads > 0 ? Math.round((data.onboarded / data.leads) * 100) : 0,
      avgDaysToOnboard:
        data.count > 0
          ? Math.round(data.totalDaysToOnboard / data.count)
          : null,
    }));

    // Avg time to first sale
    const repsWithSales = onboardedUsers.filter((u) => u.sales.length > 0);
    const avgDaysToFirstSale =
      repsWithSales.length > 0
        ? Math.round(
            repsWithSales.reduce((sum, u) => {
              const days =
                (u.sales[0].submittedAt.getTime() - u.createdAt.getTime()) /
                (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / repsWithSales.length
          )
        : null;

    return NextResponse.json({
      stats: {
        totalLeads,
        onboarded,
        conversionRate,
        avgDaysToFirstSale,
      },
      bySource,
    });
  } catch (error) {
    console.error("[GET /api/reports/recruiting-roi]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
