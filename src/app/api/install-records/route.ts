import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get("uploadId");
    const status = searchParams.get("status");
    const carrierId = searchParams.get("carrierId");

    const records = await db.installRecord.findMany({
      where: {
        ...(uploadId ? { uploadId } : {}),
        ...(status ? { status: status as "MATCHED" | "UNMATCHED" | "DISPUTED" } : {}),
        ...(carrierId ? { carrierId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        carrier: { select: { id: true, name: true } },
        matchedSale: {
          include: {
            rep: { select: { id: true, name: true } },
          },
        },
        upload: { select: { id: true, fileName: true } },
      },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("[GET /api/install-records]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
