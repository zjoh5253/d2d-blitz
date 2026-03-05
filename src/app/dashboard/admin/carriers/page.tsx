export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { CarriersClient } from "./carriers-client";

export default async function CarriersPage() {
  const carriers = await db.carrier.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <CarriersClient carriers={carriers} />
        </CardContent>
      </Card>
    </div>
  );
}
