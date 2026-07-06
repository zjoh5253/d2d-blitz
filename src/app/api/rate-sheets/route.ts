import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateSheetSchema } from "@/lib/validators/common";
import { checkGrantMargin, checkManagerGrantMargin } from "@/lib/services/min-margin";
import { getManagerScope } from "@/lib/services/payroll-scope";

const sheetInclude = {
  principal: { select: { id: true, name: true, role: true } },
  carrier: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
} as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role } = session.user;
    if (role !== "ADMIN" && role !== "MARKET_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // A MARKET_OWNER sees only the MANAGER sheets of their downline managers
    // (blind to OWNER-level / upstream economics).
    const where =
      role === "MARKET_OWNER"
        ? {
            level: "MANAGER" as const,
            principalId: { in: (await getManagerScope(session.user)).managerIds },
          }
        : undefined;

    const sheets = await db.rateSheet.findMany({
      where,
      orderBy: [{ level: "asc" }, { principalId: "asc" }, { effectiveDate: "desc" }],
      include: sheetInclude,
    });
    return NextResponse.json(sheets);
  } catch (error) {
    console.error("[GET /api/rate-sheets]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role } = session.user;
    if (role !== "ADMIN" && role !== "MARKET_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = rateSheetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { level, principalId, carrierId, productId, availableRevenue, effectiveDate, active, overrideMinMargin } =
      parsed.data;

    if (role === "MARKET_OWNER") {
      // A MARKET_OWNER may only grant MANAGER-level sheets to their downline
      // managers, capped at their own available revenue (blind to upstream).
      const { managerIds } = await getManagerScope(session.user);
      if (level !== "MANAGER" || !managerIds.includes(principalId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const margin = await checkManagerGrantMargin({
        ownerId: session.user.id,
        carrierId: carrierId || null,
        productId: productId || null,
        availableRevenue,
        at: new Date(effectiveDate),
        override: overrideMinMargin,
      });
      if (!margin.ok) {
        return NextResponse.json({ error: margin.message }, { status: 422 });
      }
    } else if (level === "OWNER") {
      // An OWNER grant is the master's top-level cut — protect the company margin.
      const margin = await checkGrantMargin({
        carrierId: carrierId || "",
        productId: productId || null,
        availableRevenue,
        override: overrideMinMargin,
      });
      if (!margin.ok) {
        return NextResponse.json({ error: margin.message }, { status: 422 });
      }
    }

    const sheet = await db.rateSheet.create({
      data: {
        level,
        principalId,
        carrierId: carrierId || null,
        productId: productId || null,
        availableRevenue,
        effectiveDate: new Date(effectiveDate),
        active,
      },
      include: sheetInclude,
    });

    return NextResponse.json(sheet, { status: 201 });
  } catch (error) {
    console.error("[POST /api/rate-sheets]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
