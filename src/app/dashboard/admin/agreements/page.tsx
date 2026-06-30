export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { AgreementsClient } from "./agreements-client";

export default async function AgreementsPage() {
  const agreements = await db.agreement.findMany({
    orderBy: [{ type: "asc" }, { version: "desc" }],
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <AgreementsClient agreements={agreements} />
        </CardContent>
      </Card>
    </div>
  );
}
