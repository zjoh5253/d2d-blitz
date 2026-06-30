/**
 * GET /api/agreements/acceptances/:id/document
 *
 * Admin-only endpoint that mints a short-lived signed URL for a private rep
 * document (e.g. W-9) attached to an AgreementAcceptance record. The raw
 * private blob URL is never sent to clients — only this transient signed URL.
 *
 * Auth: NextAuth session, ADMIN role required.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedRepDocumentUrl } from "@/lib/blob-storage";
import { captureApiError } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const acceptance = await db.agreementAcceptance.findUnique({
      where: { id },
    });

    if (!acceptance) {
      return NextResponse.json(
        { error: "Acceptance not found" },
        { status: 404 }
      );
    }

    if (!acceptance.documentUrl) {
      return NextResponse.json(
        { error: "No document on this acceptance" },
        { status: 404 }
      );
    }

    // Default 5-minute expiry — sufficient for a one-time download.
    const url = await getSignedRepDocumentUrl(acceptance.documentUrl);

    return NextResponse.json({ url });
  } catch (error) {
    captureApiError(error, "GET /api/agreements/acceptances/[id]/document");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
