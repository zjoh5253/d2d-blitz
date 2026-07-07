export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { RateSheetsClient } from "./rate-sheets-client";

export default async function RateSheetsPage() {
  const [sheets, principals, carriers] = await Promise.all([
    db.rateSheet.findMany({
      orderBy: [{ level: "asc" }, { principalId: "asc" }, { effectiveDate: "desc" }],
      include: {
        principal: { select: { id: true, name: true, role: true } },
        carrier: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({
      where: { role: { in: ["MARKET_OWNER", "FIELD_MANAGER"] }, status: "ACTIVE" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.carrier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <RateSheetsClient
            sheets={sheets}
            principals={principals}
            carriers={carriers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
