import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery, optionalId } from "@/lib/validate";

const exportQuerySchema = z.object({
  repId: optionalId,
  activeOnly: z.string().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, exportQuerySchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const { repId, activeOnly, period } = parsed.data;

    let periodFilter: { gte: Date; lt: Date } | undefined;
    if (period) {
      const [year, month] = period.split("-").map(Number);
      periodFilter = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      };
    }

    const holds = await db.complianceHold.findMany({
      where: {
        ...(repId ? { repId } : {}),
        ...(activeOnly === "true" ? { restoredDate: null } : {}),
        ...(periodFilter ? { holdDate: periodFilter } : {}),
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        restoredBy: { select: { id: true, name: true } },
      },
      orderBy: { holdDate: "desc" },
    });

    const header = [
      "Hold ID",
      "Rep Name",
      "Rep Email",
      "Hold Date",
      "Reason",
      "Status",
      "Restored Date",
      "Restored By",
    ].join(",");

    const rows = holds.map((h) => {
      const status = h.restoredDate ? "Restored" : "Active";
      const restoredDate = h.restoredDate
        ? new Date(h.restoredDate).toISOString()
        : "";
      const restoredBy = h.restoredBy?.name ?? "";

      return [
        h.id,
        `"${(h.rep.name ?? "").replace(/"/g, '""')}"`,
        `"${h.rep.email.replace(/"/g, '""')}"`,
        new Date(h.holdDate).toISOString(),
        `"${h.reason.replace(/"/g, '""')}"`,
        status,
        restoredDate,
        `"${restoredBy.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    const filename = period
      ? `compliance-holds-${period}.csv`
      : "compliance-holds.csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/compliance-holds/export]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
