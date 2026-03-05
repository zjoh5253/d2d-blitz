import { db } from "@/lib/db";

export async function calculateGovernanceForMonth(month: number, year: number) {
  const reps = await db.user.findMany({
    where: { role: "FIELD_REP", status: "ACTIVE" },
    include: { governanceTier: true },
  });

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const results = [];

  for (const rep of reps) {
    // Count submitted and verified installs for the month
    const submittedInstalls = await db.sale.count({
      where: {
        repId: rep.id,
        submittedAt: { gte: startDate, lte: endDate },
      },
    });

    const verifiedInstalls = await db.sale.count({
      where: {
        repId: rep.id,
        status: "VERIFIED",
        submittedAt: { gte: startDate, lte: endDate },
      },
    });

    // Skip reps with no submissions (grace period)
    if (submittedInstalls === 0) continue;

    const installRate = verifiedInstalls / submittedInstalls;

    // Get previous period for strike tracking
    const prevPeriod = await db.governancePeriod.findFirst({
      where: {
        repId: rep.id,
        OR: [
          { month: month === 1 ? 12 : month - 1, year: month === 1 ? year - 1 : year },
        ],
      },
    });

    const currentTier = rep.governanceTier;
    if (!currentTier) continue;

    const isStrike = installRate < currentTier.minInstallRate;
    const prevStrikes = prevPeriod?.consecutiveStrikes ?? 0;
    const consecutiveStrikes = isStrike ? prevStrikes + 1 : 0;

    let newTierId = currentTier.id;

    if (consecutiveStrikes >= 2) {
      // Reduce tier (find next lower rank)
      const lowerTier = await db.governanceTier.findFirst({
        where: { rank: { gt: currentTier.rank } },
        orderBy: { rank: "asc" },
      });
      if (lowerTier) {
        newTierId = lowerTier.id;
      }
    } else if (!isStrike && prevPeriod?.isStrike && prevStrikes >= 2) {
      // Qualifying month after reduction - restore previous tier
      const higherTier = await db.governanceTier.findFirst({
        where: { rank: { lt: currentTier.rank } },
        orderBy: { rank: "desc" },
      });
      if (higherTier) {
        newTierId = higherTier.id;
      }
    }

    // Create/update governance period
    const period = await db.governancePeriod.upsert({
      where: {
        repId_month_year: { repId: rep.id, month, year },
      },
      create: {
        repId: rep.id,
        month,
        year,
        submittedInstalls,
        verifiedInstalls,
        installRate,
        tierId: newTierId,
        isStrike,
        consecutiveStrikes,
      },
      update: {
        submittedInstalls,
        verifiedInstalls,
        installRate,
        tierId: newTierId,
        isStrike,
        consecutiveStrikes,
      },
    });

    // Update user's governance tier
    if (newTierId !== currentTier.id) {
      await db.user.update({
        where: { id: rep.id },
        data: { governanceTierId: newTierId },
      });
    }

    results.push({
      repId: rep.id,
      repName: rep.name,
      installRate,
      isStrike,
      consecutiveStrikes,
      tierChanged: newTierId !== currentTier.id,
    });
  }

  return results;
}
