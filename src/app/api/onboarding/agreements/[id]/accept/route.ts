/**
 * POST /api/onboarding/agreements/:id/accept
 *
 * Records this rep's acceptance of an active agreement. Accepts
 * multipart/form-data with:
 *   - signatureName (string, required)
 *   - document      (File, required only when the agreement requiresUpload)
 *
 * The acceptance is upserted on the (userId, agreementId) unique key so a rep
 * can re-accept after a version bump. When a document is supplied it is stored
 * via blob storage and its URL recorded.
 *
 * Auth: mobile Bearer token via getSessionFromRequest.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { uploadRepDocument, deleteRepDocument } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await params;

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }

    const signatureName = form.get("signatureName");
    if (typeof signatureName !== "string" || signatureName.trim() === "") {
      return NextResponse.json(
        { error: "signatureName is required" },
        { status: 400 }
      );
    }

    const agreement = await db.agreement.findFirst({
      where: { id, isActive: true },
    });
    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    const documentField = form.get("document");
    const document =
      documentField instanceof File && documentField.size > 0
        ? documentField
        : null;

    if (agreement.requiresUpload && !document) {
      return NextResponse.json(
        { error: "Document required" },
        { status: 400 }
      );
    }

    // Look up any existing acceptance so we can clean up an old blob on re-accept.
    const existing = await db.agreementAcceptance.findUnique({
      where: { userId_agreementId: { userId, agreementId: agreement.id } },
      select: { documentUrl: true },
    });

    let documentUrl: string | null = null;
    if (document) {
      documentUrl = await uploadRepDocument(document, userId, agreement.type);
    }

    const acceptedAt = new Date();

    const acceptance = await db.agreementAcceptance.upsert({
      where: {
        userId_agreementId: { userId, agreementId: agreement.id },
      },
      create: {
        agreementId: agreement.id,
        userId,
        version: agreement.version,
        signatureName: signatureName.trim(),
        documentUrl,
        acceptedAt,
      },
      update: {
        version: agreement.version,
        signatureName: signatureName.trim(),
        documentUrl,
        acceptedAt,
      },
    });

    // RETENTION: best-effort delete the previous private blob when a rep
    // re-accepts an agreement that already had a document stored.
    if (document && existing?.documentUrl) {
      void deleteRepDocument(existing.documentUrl);
    }

    // Do NOT return the raw private blob URL to the client.
    // Admins retrieve a short-lived signed URL via
    // GET /api/agreements/acceptances/:id/document instead.
    return NextResponse.json({
      id: agreement.id,
      type: agreement.type,
      accepted: true,
      acceptedAt: acceptance.acceptedAt.toISOString(),
      documentUrl: null,
      hasDocument: acceptance.documentUrl !== null,
    });
  } catch (error) {
    console.error("[POST /api/onboarding/agreements/:id/accept]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
