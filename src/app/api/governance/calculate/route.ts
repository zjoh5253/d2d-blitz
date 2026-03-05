import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const calculateSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
});

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
    const parsed = calculateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { month, year } = parsed.data;

    // Date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Get all active FIELD_REPs
    const reps = await db.user.findMany({
      where: { role: "FIELD_REP", status: "ACTIVE" },
      include: { governanceTier: true },
    });

    // Get all tiers sorted by rank descending (best tier = highest rank)
    const tiers = await db.governanceTier.findMany({
      orderBy: { rank: "desc" },
    });

    if (tiers.length === 0) {
      return NextResponse.json(
        { error: "No governance tiers configured" },
        { status: 422 }
      );
    }

    const defaultTier = tiers.find((t) => t.isDefault) ?? tiers[tiers.length - 1];
    const results: Array<{
      repId: string;
      repName: string | null;
      submittedInstalls: number;
      verifiedInstalls: number;
      installRate: number;
      tierId: string;
      tierName: string;
      isStrike: boolean;
      consecutiveStrikes: number;
    }> = [];

    for (const rep of reps) {
      // Count submitted installs (sales submittedAt in month)
      const submittedInstalls = await db.sale.count({
        where: {
          repId: rep.id,
          submittedAt: { gte: startDate, lt: endDate },
        },
      });

      // Count verified installs (sales with VERIFIED status in month)
      const verifiedInstalls = await db.sale.count({
        where: {
          repId: rep.id,
          status: "VERIFIED",
          submittedAt: { gte: startDate, lt: endDate },
        },
      });

      const installRate =
        submittedInstalls > 0 ? verifiedInstalls / submittedInstalls : 0;

      // Get previous governance period for consecutive strikes
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const prevPeriod = await db.governancePeriod.findUnique({
        where: { repId_month_year: { repId: rep.id, month: prevMonth, year: prevYear } },
      });

      // Determine current tier
      const currentTier = rep.governanceTier ?? defaultTier;

      // Check if installRate meets current tier's minInstallRate
      const isStrike = installRate < currentTier.minInstallRate;

      let consecutiveStrikes = isStrike
        ? (prevPeriod?.consecutiveStrikes ?? 0) + 1
        : 0;

      // Determine new tier
      let newTier = currentTier;

      if (consecutiveStrikes >= 2) {
        // Reduce tier (move to lower rank)
        const lowerTier = tiers.find((t) => t.rank < currentTier.rank);
        if (lowerTier) {
          newTier = lowerTier;
        }
      } else if (!isStrike && prevPeriod?.consecutiveStrikes && prevPeriod.consecutiveStrikes >= 2) {
        // Single qualifying month after demotion: restore previous tier
        const prevPeriodTier = tiers.find((t) => t.id === prevPeriod.tierId);
        const higherTier = tiers.find(
          (t) => t.rank > (prevPeriodTier?.rank ?? 0)
        );
        if (higherTier) {
          newTier = higherTier;
          consecutiveStrikes = 0;
        }
      }

      // Upsert GovernancePeriod
      await db.governancePeriod.upsert({
        where: { repId_month_year: { repId: rep.id, month, year } },
        create: {
          repId: rep.id,
          month,
          year,
          submittedInstalls,
          verifiedInstalls,
          installRate,
          tierId: newTier.id,
          isStrike,
          consecutiveStrikes,
        },
        update: {
          submittedInstalls,
          verifiedInstalls,
          installRate,
          tierId: newTier.id,
          isStrike,
          consecutiveStrikes,
        },
      });

      // Update user's governanceTierId
      await db.user.update({
        where: { id: rep.id },
        data: { governanceTierId: newTier.id },
      });

      results.push({
        repId: rep.id,
        repName: rep.name,
        submittedInstalls,
        verifiedInstalls,
        installRate,
        tierId: newTier.id,
        tierName: newTier.name,
        isStrike,
        consecutiveStrikes,
      });
    }

    return NextResponse.json({
      month,
      year,
      repsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error("[POST /api/governance/calculate]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
