export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { GovernanceClient } from "./governance-client";

export default async function GovernancePage() {
  const tiers = await db.governanceTier.findMany({
    orderBy: { rank: "asc" },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <GovernanceClient tiers={tiers} />
        </CardContent>
      </Card>
    </div>
  );
}
