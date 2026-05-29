import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai/client";
import { ingestFile, parseLooseDate } from "@/lib/installs/ingest";
import { extractInstallRecords } from "@/lib/installs/ai-extract";
import { bestMatch, type SaleLike } from "@/lib/installs/match";

// AI-driven install-report upload. Replaces the manual-column-mapping flow:
// the operator just picks a carrier and drops a CSV / XLSX / PDF. The AI
// parser figures out the layout, we reconcile against open sales with the
// smart matcher, and only HIGH-confidence matches auto-verify a sale —
// MEDIUM matches are recorded but flagged as exceptions for review.

export const maxDuration = 300; // AI extraction on a large/scanned PDF can be slow.

type OpenSale = SaleLike & { id: string };

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        { error: "AI parsing is not configured. Set ANTHROPIC_API_KEY on the server." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const carrierId = formData.get("carrierId") as string | null;
    if (!file || !carrierId) {
      return NextResponse.json({ error: "file and carrierId are required" }, { status: 400 });
    }

    const carrier = await db.carrier.findUnique({ where: { id: carrierId } });
    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    // 1. Ingest (format detection) + 2. AI extraction.
    let extraction;
    try {
      const ingest = await ingestFile(file);
      extraction = await extractInstallRecords(ingest);
    } catch (e) {
      console.error("[installs/upload] extraction failed", e);
      return NextResponse.json(
        { error: `Could not parse the file: ${e instanceof Error ? e.message : String(e)}` },
        { status: 422 }
      );
    }

    const { records, method, mapping, notes } = extraction;
    if (records.length === 0) {
      return NextResponse.json(
        { error: "No install records could be extracted from the file." },
        { status: 422 }
      );
    }

    // 3. Create the upload row.
    const upload = await db.installUpload.create({
      data: {
        carrierId,
        uploadedById: session.user.id,
        fileName: file.name,
        rowCount: records.length,
        parseMethod: method,
        notes: notes ?? undefined,
      },
    });

    // 4. Fetch the carrier's open, not-yet-reconciled sales once, match in memory.
    const openSales = await db.sale.findMany({
      where: {
        carrierId,
        status: { in: ["SUBMITTED", "PENDING_INSTALL", "INSTALLED"] },
        matchedInstallRecord: null,
      },
      select: { id: true, customerName: true, customerAddress: true, installDate: true },
    });
    const pool: OpenSale[] = openSales.map((s) => ({ ...s }));

    let matchedCount = 0;
    let unmatchedCount = 0;
    let exceptionCount = 0;

    for (const rec of records) {
      const installDate = parseLooseDate(rec.installDate);
      const match = bestMatch({ ...rec, installDate }, pool);

      const base = {
        uploadId: upload.id,
        carrierId,
        externalId: rec.externalId ?? undefined,
        customerName: rec.customerName,
        customerAddress: rec.customerAddress,
        installDate: installDate ?? undefined,
        extractionConfidence: rec.confidence,
        rawData: JSON.stringify(rec),
      };

      if (match && match.score.tier === "high") {
        // Confident match → verify the sale.
        await db.installRecord.create({
          data: {
            ...base,
            status: "MATCHED",
            matchedSaleId: match.sale.id,
            matchScore: match.score.overall,
            matchConfidence: "high",
          },
        });
        await db.sale.update({ where: { id: match.sale.id }, data: { status: "VERIFIED" } });
        pool.splice(pool.indexOf(match.sale), 1);
        matchedCount++;
      } else if (match && match.score.tier === "medium") {
        // Plausible but uncertain → record the match, mark the sale installed
        // (NOT verified), and flag an exception for a human to confirm.
        const ir = await db.installRecord.create({
          data: {
            ...base,
            status: "MATCHED",
            matchedSaleId: match.sale.id,
            matchScore: match.score.overall,
            matchConfidence: "medium",
          },
        });
        await db.sale.update({ where: { id: match.sale.id }, data: { status: "INSTALLED" } });
        await db.installException.create({
          data: {
            installRecordId: ir.id,
            saleId: match.sale.id,
            reason: `Medium-confidence match (address ${(match.score.addressScore * 100).toFixed(0)}%, name ${(
              match.score.nameScore * 100
            ).toFixed(0)}%, date ${(match.score.dateScore * 100).toFixed(0)}%). Please verify.`,
          },
        });
        pool.splice(pool.indexOf(match.sale), 1);
        matchedCount++;
        exceptionCount++;
      } else {
        // No candidate cleared the bar.
        await db.installRecord.create({ data: { ...base, status: "UNMATCHED" } });
        unmatchedCount++;
      }
    }

    await db.installUpload.update({
      where: { id: upload.id },
      data: { matchedCount, unmatchedCount, exceptionCount },
    });

    return NextResponse.json({
      uploadId: upload.id,
      method,
      mapping: mapping ?? null,
      rowCount: records.length,
      matchedCount,
      unmatchedCount,
      exceptionCount,
      notes: notes ?? null,
    });
  } catch (error) {
    console.error("[POST /api/installs/upload]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
