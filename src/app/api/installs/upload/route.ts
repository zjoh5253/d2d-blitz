import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai/client";
import { ingestFile, parseLooseDate } from "@/lib/installs/ingest";
import { extractInstallRecords } from "@/lib/installs/ai-extract";
import { bestMatch, type SaleLike } from "@/lib/installs/match";
import { resolveRepId } from "@/lib/installs/rep-resolve";

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

    // Users for rep attribution — resolve the report's rep/agent name → user.
    const users = await db.user.findMany({ select: { id: true, name: true } });

    let matchedCount = 0;
    let unmatchedCount = 0;
    let exceptionCount = 0;
    let updatedCount = 0;
    const seenExternal = new Set<string>();

    for (const rec of records) {
      const ext = rec.externalId?.trim() || null;
      // Dedupe duplicate rows inside one file (reports repeat orders per page).
      if (ext) {
        if (seenExternal.has(ext)) continue;
        seenExternal.add(ext);
      }

      const installDate = parseLooseDate(rec.installDate);
      const repId = resolveRepId(rec.rep, users);

      // Shared fields, incl. rep attribution straight from the report.
      const base = {
        customerName: rec.customerName,
        customerAddress: rec.customerAddress,
        installDate: installDate ?? undefined,
        extractionConfidence: rec.confidence,
        repName: rec.rep ?? undefined,
        repId: repId ?? undefined,
        orderStatus: rec.status ?? undefined,
        rawData: JSON.stringify(rec),
      };

      // Cross-upload dedupe: same carrier + order # → update in place.
      const existing = ext
        ? await db.installRecord.findFirst({
            where: { carrierId, externalId: ext },
            select: { id: true, status: true },
          })
        : null;

      if (existing) {
        const extra: Record<string, unknown> = {};
        // Re-attempt a match only if it's still unmatched (sales may have been
        // entered since the last upload).
        if (existing.status === "UNMATCHED") {
          const m = bestMatch({ ...rec, installDate }, pool);
          if (m) {
            extra.status = "MATCHED";
            extra.matchedSaleId = m.sale.id;
            extra.matchScore = m.score.overall;
            extra.matchConfidence = m.score.tier;
            await db.sale.update({
              where: { id: m.sale.id },
              data: { status: m.score.tier === "high" ? "VERIFIED" : "INSTALLED" },
            });
            pool.splice(pool.indexOf(m.sale), 1);
          }
        }
        await db.installRecord.update({ where: { id: existing.id }, data: { ...base, ...extra } });
        updatedCount++;
        continue;
      }

      const match = bestMatch({ ...rec, installDate }, pool);
      const create = { ...base, uploadId: upload.id, carrierId, externalId: ext ?? undefined };

      if (match && match.score.tier === "high") {
        await db.installRecord.create({
          data: { ...create, status: "MATCHED", matchedSaleId: match.sale.id, matchScore: match.score.overall, matchConfidence: "high" },
        });
        await db.sale.update({ where: { id: match.sale.id }, data: { status: "VERIFIED" } });
        pool.splice(pool.indexOf(match.sale), 1);
        matchedCount++;
      } else if (match && match.score.tier === "medium") {
        const ir = await db.installRecord.create({
          data: { ...create, status: "MATCHED", matchedSaleId: match.sale.id, matchScore: match.score.overall, matchConfidence: "medium" },
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
        await db.installRecord.create({ data: { ...create, status: "UNMATCHED" } });
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
      updatedCount,
      notes: notes ?? null,
    });
  } catch (error) {
    console.error("[POST /api/installs/upload]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
