export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const [products, carriers] = await Promise.all([
    db.product.findMany({
      orderBy: [{ carrierId: "asc" }, { name: "asc" }],
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
          <ProductsClient products={products} carriers={carriers} />
        </CardContent>
      </Card>
    </div>
  );
}
