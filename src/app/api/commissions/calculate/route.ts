import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN/EXECUTIVE can trigger commission calculation
    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all VERIFIED sales without a commission record
    const verifiedSales = await db.sale.findMany({
      where: {
        status: "VERIFIED",
        commissionRecord: null,
      },
      include: {
        carrier: true,
        rep: {
          include: {
            governanceTier: true,
          },
        },
        blitz: {
          include: {
            market: true,
          },
        },
      },
    });

    if (verifiedSales.length === 0) {
      return NextResponse.json({
        created: 0,
        message: "No eligible sales found",
      });
    }

    let created = 0;
    const errors: string[] = [];

    for (const sale of verifiedSales) {
      try {
        const carrierId = sale.carrierId;
        const marketId = sale.blitz.marketId;

        // Get most recent active StackConfig for carrier/market
        // Prefer market-specific, then carrier-wide
        const stackConfig = await db.stackConfig.findFirst({
          where: {
            carrierId,
            effectiveDate: { lte: new Date() },
            OR: [{ marketId }, { marketId: null }],
          },
          orderBy: [
            // market-specific configs first (marketId NOT null)
            { effectiveDate: "desc" },
          ],
        });

        // If no market-specific, fall back to carrier-wide
        const activeConfig = stackConfig
          ? stackConfig
          : await db.stackConfig.findFirst({
              where: {
                carrierId,
                marketId: null,
                effectiveDate: { lte: new Date() },
              },
              orderBy: { effectiveDate: "desc" },
            });

        if (!activeConfig) {
          errors.push(
            `No StackConfig found for carrier ${sale.carrier.name} — skipped sale ${sale.id}`
          );
          continue;
        }

        const carrierPayout = sale.carrier.revenuePerInstall;
        const companyFloor =
          (activeConfig.companyFloorPercent / 100) * carrierPayout;
        const managerOverride =
          (activeConfig.managerOverridePercent / 100) * carrierPayout;
        const marketOwnerSpread =
          (activeConfig.marketOwnerSpreadPercent / 100) * carrierPayout;

        // Remaining is base rep pay; apply governance tier multiplier
        const basePct =
          100 -
          activeConfig.companyFloorPercent -
          activeConfig.managerOverridePercent -
          activeConfig.marketOwnerSpreadPercent;
        const baseRepPay = (basePct / 100) * carrierPayout;
        const multiplier = sale.rep.governanceTier?.commissionMultiplier ?? 1.0;
        const repPay = baseRepPay * multiplier;

        await db.commissionRecord.create({
          data: {
            saleId: sale.id,
            repId: sale.repId,
            blitzId: sale.blitzId,
            carrierPayout,
            companyFloor,
            managerOverride,
            marketOwnerSpread,
            repPay,
            status: "ELIGIBLE",
            governanceTierId: sale.rep.governanceTierId ?? null,
          },
        });

        created++;
      } catch (err) {
        errors.push(
          `Failed to process sale ${sale.id}: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    return NextResponse.json({
      created,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${created} commission records`,
    });
  } catch (error) {
    console.error("[POST /api/commissions/calculate]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
