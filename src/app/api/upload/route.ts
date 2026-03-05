import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Papa from "papaparse";

type ColumnMapping = {
  customerName: string;
  customerAddress: string;
  installDate: string;
  externalId?: string;
};

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const carrierId = formData.get("carrierId") as string | null;
    const columnMappingRaw = formData.get("columnMapping") as string | null;

    if (!file || !carrierId) {
      return NextResponse.json(
        { error: "file and carrierId are required" },
        { status: 400 }
      );
    }

    let columnMapping: ColumnMapping;
    try {
      columnMapping = JSON.parse(columnMappingRaw ?? "{}");
    } catch {
      return NextResponse.json(
        { error: "Invalid columnMapping JSON" },
        { status: 400 }
      );
    }

    if (!columnMapping.customerName || !columnMapping.customerAddress || !columnMapping.installDate) {
      return NextResponse.json(
        { error: "columnMapping must include customerName, customerAddress, and installDate" },
        { status: 400 }
      );
    }

    // Verify carrier exists
    const carrier = await db.carrier.findUnique({ where: { id: carrierId } });
    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    // Parse CSV
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: "Failed to parse CSV" }, { status: 400 });
    }

    const rows = parsed.data;
    const rowCount = rows.length;

    if (rowCount === 0) {
      return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
    }

    // Create InstallUpload record
    const upload = await db.installUpload.create({
      data: {
        carrierId,
        uploadedById: session.user.id,
        fileName: file.name,
        rowCount,
        matchedCount: 0,
        unmatchedCount: 0,
      },
    });

    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const row of rows) {
      const customerName = normalize(row[columnMapping.customerName] ?? "");
      const customerAddress = normalize(row[columnMapping.customerAddress] ?? "");
      const installDateRaw = row[columnMapping.installDate] ?? "";
      const externalId = columnMapping.externalId ? (row[columnMapping.externalId] ?? null) : null;

      if (!customerName || !customerAddress || !installDateRaw) {
        unmatchedCount++;
        await db.installRecord.create({
          data: {
            uploadId: upload.id,
            carrierId,
            externalId: externalId ?? undefined,
            customerName: row[columnMapping.customerName] ?? "",
            customerAddress: row[columnMapping.customerAddress] ?? "",
            installDate: new Date(),
            status: "UNMATCHED",
          },
        });
        continue;
      }

      const installDate = new Date(installDateRaw);
      if (isNaN(installDate.getTime())) {
        unmatchedCount++;
        await db.installRecord.create({
          data: {
            uploadId: upload.id,
            carrierId,
            externalId: externalId ?? undefined,
            customerName: row[columnMapping.customerName] ?? "",
            customerAddress: row[columnMapping.customerAddress] ?? "",
            installDate: new Date(),
            status: "UNMATCHED",
          },
        });
        continue;
      }

      // Try to find a matching sale: fuzzy match on customerName + customerAddress + installDate
      // installDate window: ±3 days to handle timezone/format differences
      const dateFrom = new Date(installDate);
      dateFrom.setDate(dateFrom.getDate() - 3);
      const dateTo = new Date(installDate);
      dateTo.setDate(dateTo.getDate() + 3);

      const candidateSales = await db.sale.findMany({
        where: {
          carrierId,
          status: { in: ["SUBMITTED", "PENDING_INSTALL", "INSTALLED"] },
          installDate: { gte: dateFrom, lte: dateTo },
          matchedInstallRecord: null,
        },
        select: {
          id: true,
          customerName: true,
          customerAddress: true,
          installDate: true,
        },
      });

      const matchedSale = candidateSales.find((sale) => {
        const saleNameNorm = normalize(sale.customerName);
        const saleAddrNorm = normalize(sale.customerAddress);
        return saleNameNorm === customerName && saleAddrNorm === customerAddress;
      });

      if (matchedSale) {
        matchedCount++;
        await db.installRecord.create({
          data: {
            uploadId: upload.id,
            carrierId,
            externalId: externalId ?? undefined,
            customerName: row[columnMapping.customerName] ?? "",
            customerAddress: row[columnMapping.customerAddress] ?? "",
            installDate,
            status: "MATCHED",
            matchedSaleId: matchedSale.id,
          },
        });
        // Update sale status to VERIFIED
        await db.sale.update({
          where: { id: matchedSale.id },
          data: { status: "VERIFIED" },
        });
      } else {
        unmatchedCount++;
        await db.installRecord.create({
          data: {
            uploadId: upload.id,
            carrierId,
            externalId: externalId ?? undefined,
            customerName: row[columnMapping.customerName] ?? "",
            customerAddress: row[columnMapping.customerAddress] ?? "",
            installDate,
            status: "UNMATCHED",
          },
        });
      }
    }

    // Update upload summary
    await db.installUpload.update({
      where: { id: upload.id },
      data: { matchedCount, unmatchedCount },
    });

    return NextResponse.json({
      uploadId: upload.id,
      rowCount,
      matchedCount,
      unmatchedCount,
    });
  } catch (error) {
    console.error("[POST /api/upload]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
