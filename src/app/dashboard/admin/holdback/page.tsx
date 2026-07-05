export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { HoldbackClient } from "./holdback-client";

export default async function HoldbackPage() {
  const [policies, carriers] = await Promise.all([
    db.holdbackPolicy.findMany({
      orderBy: [{ carrierId: "asc" }, { effectiveDate: "desc" }],
      include: {
        carrier: { select: { id: true, name: true } },
      },
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
          <HoldbackClient policies={policies} carriers={carriers} />
        </CardContent>
      </Card>
    </div>
  );
}
