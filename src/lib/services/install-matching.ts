import { db } from "@/lib/db";

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

function fuzzyMatch(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function dateMatch(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function matchInstallRecords(uploadId: string) {
  const records = await db.installRecord.findMany({
    where: { uploadId, status: "UNMATCHED" },
  });

  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const record of records) {
    // Find matching sale by customer name + address + install date
    const matchingSale = await db.sale.findFirst({
      where: {
        carrierId: record.carrierId,
        status: { in: ["SUBMITTED", "PENDING_INSTALL", "INSTALLED"] },
      },
    });

    // More precise matching with fuzzy logic
    const potentialSales = await db.sale.findMany({
      where: {
        carrierId: record.carrierId,
        status: { in: ["SUBMITTED", "PENDING_INSTALL", "INSTALLED"] },
      },
    });

    let matched = false;
    for (const sale of potentialSales) {
      const nameMatch = fuzzyMatch(record.customerName, sale.customerName);
      const addressMatch = fuzzyMatch(record.customerAddress, sale.customerAddress);
      const installDateMatch = dateMatch(
        new Date(record.installDate),
        new Date(sale.installDate)
      );

      if (nameMatch && addressMatch && installDateMatch) {
        // Match found
        await db.installRecord.update({
          where: { id: record.id },
          data: { status: "MATCHED", matchedSaleId: sale.id },
        });

        await db.sale.update({
          where: { id: sale.id },
          data: { status: "VERIFIED" },
        });

        matchedCount++;
        matched = true;
        break;
      } else if ((nameMatch && addressMatch) || (addressMatch && installDateMatch)) {
        // Partial match - flag for review but still match
        await db.installRecord.update({
          where: { id: record.id },
          data: { status: "MATCHED", matchedSaleId: sale.id },
        });

        await db.sale.update({
          where: { id: sale.id },
          data: { status: "VERIFIED" },
        });

        // Create exception for review
        await db.installException.create({
          data: {
            installRecordId: record.id,
            saleId: sale.id,
            reason: "Partial match - some fields differ. Please verify.",
          },
        });

        matchedCount++;
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmatchedCount++;
    }
  }

  // Update upload counts
  await db.installUpload.update({
    where: { id: uploadId },
    data: {
      matchedCount: { increment: matchedCount },
      unmatchedCount: { increment: unmatchedCount },
    },
  });

  return { matchedCount, unmatchedCount };
}
