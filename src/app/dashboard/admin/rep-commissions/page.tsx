export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { RepCommissionsClient } from "./rep-commissions-client";

export default async function RepCommissionsPage() {
  const [overrides, reps, carriers] = await Promise.all([
    db.repCommissionOverride.findMany({
      orderBy: [{ repId: "asc" }, { effectiveDate: "desc" }],
      include: {
        rep: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({
      where: { role: "FIELD_REP", status: "ACTIVE" },
      select: { id: true, name: true },
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
          <RepCommissionsClient
            overrides={overrides}
            reps={reps}
            carriers={carriers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
