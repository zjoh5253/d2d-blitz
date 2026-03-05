export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StackClient } from "./stack-client";

export default async function StackPage() {
  const [configs, carriers, markets] = await Promise.all([
    db.stackConfig.findMany({
      orderBy: { effectiveDate: "desc" },
      include: {
        carrier: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
    }),
    db.carrier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.market.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <StackClient configs={configs} carriers={carriers} markets={markets} />
        </CardContent>
      </Card>
    </div>
  );
}
