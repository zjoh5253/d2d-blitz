import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyCommissionPosted } from "@/lib/services/notifications";
import {
  resolveHoldbackPolicy,
  splitHoldback,
  upsertHoldback,
} from "@/lib/services/holdback";
import { upsertOverrideEarnings } from "@/lib/services/override-earning";
import { resolveRepOverride } from "@/lib/services/rep-commission";
import { applyRateSheets } from "@/lib/services/rate-sheet";
import { captureServerEvent } from "@/lib/posthog";
import { captureApiError } from "@/lib/sentry";

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
        product: true,
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

        // Resolve the most specific active rate sheet: product+market → product →
        // market → carrier-wide (`nulls: last` puts specific configs first).
        const productFilter = sale.productId
          ? { OR: [{ productId: sale.productId }, { productId: null }] }
          : { productId: null };
        const activeConfig = await db.stackConfig.findFirst({
          where: {
            carrierId,
            effectiveDate: { lte: new Date() },
            AND: [productFilter, { OR: [{ marketId }, { marketId: null }] }],
          },
          orderBy: [
            { productId: { sort: "desc", nulls: "last" } },
            { marketId: { sort: "desc", nulls: "last" } },
            { effectiveDate: "desc" },
          ],
        });

        if (!activeConfig) {
          errors.push(
            `No StackConfig found for carrier ${sale.carrier.name} — skipped sale ${sale.id}`
          );
          continue;
        }

        // Product revenue takes precedence; fall back to the carrier default.
        const carrierPayout = sale.product?.revenue ?? sale.carrier.revenuePerInstall;
        const baselineCompanyFloor =
          (activeConfig.companyFloorPercent / 100) * carrierPayout;
        const baselineManagerOverride =
          (activeConfig.managerOverridePercent / 100) * carrierPayout;
        const baselineMarketOwnerSpread =
          (activeConfig.marketOwnerSpreadPercent / 100) * carrierPayout;

        // Remaining is base rep pay; apply governance tier multiplier
        const basePct =
          100 -
          activeConfig.companyFloorPercent -
          activeConfig.managerOverridePercent -
          activeConfig.marketOwnerSpreadPercent;
        const baseRepPay = (basePct / 100) * carrierPayout;

        // A custom per-rep override replaces the computed pay outright (tier
        // multiplier bypassed); otherwise apply the governance-tier multiplier.
        const repOverride = await resolveRepOverride({
          repId: sale.repId,
          carrierId,
          productId: sale.productId,
          at: sale.submittedAt,
        });
        const repPay = repOverride
          ? repOverride.amount
          : baseRepPay * (sale.rep.governanceTier?.commissionMultiplier ?? 1.0);

        // Overlay the hierarchical rate-sheet chain (baseline preserved when none).
        const { companyFloor, managerOverride, marketOwnerSpread } = await applyRateSheets({
          carrierPayout,
          baselineCompanyFloor,
          baselineManagerOverride,
          baselineMarketOwnerSpread,
          repPay,
          managerId: sale.blitz.managerId,
          ownerId: sale.blitz.market.ownerId,
          carrierId,
          productId: sale.productId,
          at: sale.submittedAt,
        });

        // Hold back a slice for the retention period; pay the immediate portion now.
        const policy = await resolveHoldbackPolicy(carrierId, sale.submittedAt);
        const { immediate, held, percent, releaseAt } = splitHoldback(
          repPay,
          policy,
          sale.submittedAt
        );

        const record = await db.commissionRecord.create({
          data: {
            saleId: sale.id,
            repId: sale.repId,
            blitzId: sale.blitzId,
            carrierPayout,
            companyFloor,
            managerOverride,
            marketOwnerSpread,
            repPay: immediate,
            status: "ELIGIBLE",
            governanceTierId: sale.rep.governanceTierId ?? null,
            productId: sale.productId,
            repCommissionOverrideId: repOverride?.id ?? null,
          },
        });

        if (held > 0) {
          await upsertHoldback({
            commissionRecordId: record.id,
            repId: sale.repId,
            carrierId,
            amount: held,
            percent,
            releaseAt,
          });
        }

        // Override slices are payable to the blitz's manager and market owner.
        await upsertOverrideEarnings({
          commissionRecordId: record.id,
          managerId: sale.blitz.managerId,
          ownerId: sale.blitz.market.ownerId,
          managerOverride,
          marketOwnerSpread,
        });

        // Fire-and-forget push notification (immediate portion)
        notifyCommissionPosted({
          repId: sale.repId,
          blitzId: sale.blitzId,
          blitzName: sale.blitz.name,
          repPay: immediate,
        }).catch((err) =>
          console.error("[commissions/calculate] push notification failed:", err)
        );

        created++;
      } catch (err) {
        errors.push(
          `Failed to process sale ${sale.id}: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    captureServerEvent(session.user.id, "commissions_calculated", {
      records_created: created,
      error_count: errors.length,
    })

    return NextResponse.json({
      created,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${created} commission records`,
    });
  } catch (error) {
    console.error("[POST /api/commissions/calculate]", error);
    captureApiError(error, "[POST /api/commissions/calculate]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
