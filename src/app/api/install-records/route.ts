import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery, optionalId, InstallRecordStatusSchema } from "@/lib/validate";
import { captureApiError } from "@/lib/sentry";

const installRecordsQuerySchema = z.object({
  uploadId: optionalId,
  status: InstallRecordStatusSchema.optional(),
  carrierId: optionalId,
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, installRecordsQuerySchema);

    if (!parsed.success) {
      return parsed.response;
    }

    const { uploadId, status, carrierId } = parsed.data;

    const records = await db.installRecord.findMany({
      where: {
        ...(uploadId ? { uploadId } : {}),
        ...(status ? { status } : {}),
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
    captureApiError(error, "[GET /api/install-records]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
