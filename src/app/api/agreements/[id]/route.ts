import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agreementSchema } from "@/lib/validators/common";
import { deleteRepDocument } from "@/lib/blob-storage";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = agreementSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, title, body: agreementBody, version, required, blocking, requiresUpload, isActive } = parsed.data;

    const agreement = await db.agreement.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(title !== undefined && { title }),
        ...(agreementBody !== undefined && { body: agreementBody }),
        ...(version !== undefined && { version }),
        ...(required !== undefined && { required }),
        ...(blocking !== undefined && { blocking }),
        ...(requiresUpload !== undefined && { requiresUpload }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(agreement);
  } catch (error) {
    console.error("[PUT /api/agreements/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // RETENTION: best-effort delete private blobs from all acceptances before
    // the DB row is removed. The DB cascade handles the acceptance rows; this
    // prevents orphaned blobs in Vercel Blob storage.
    const acceptancesWithDocs = await db.agreementAcceptance.findMany({
      where: { agreementId: id, documentUrl: { not: null } },
      select: { documentUrl: true },
    });
    for (const acc of acceptancesWithDocs) {
      if (acc.documentUrl) {
        void deleteRepDocument(acc.documentUrl);
      }
    }

    await db.agreement.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/agreements/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
