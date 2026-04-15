import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery } from "@/lib/validate";

const searchSalesQuerySchema = z.object({
  q: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, searchSalesQuerySchema);

    if (!parsed.success) {
      return parsed.response;
    }

    const q = parsed.data.q ?? "";

    // Get the install record to know the carrier
    const record = await db.installRecord.findUnique({
      where: { id },
      select: { carrierId: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Install record not found" }, { status: 404 });
    }

    if (!q.trim()) {
      return NextResponse.json([]);
    }

    const sales = await db.sale.findMany({
      where: {
        carrierId: record.carrierId,
        status: { in: ["SUBMITTED", "PENDING_INSTALL", "INSTALLED", "VERIFIED"] },
        matchedInstallRecord: null,
        OR: [
          { customerName: { contains: q, mode: "insensitive" } },
          { customerAddress: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
      include: {
        rep: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    return NextResponse.json(sales);
  } catch (error) {
    console.error("[GET /api/install-records/[id]/search-sales]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
