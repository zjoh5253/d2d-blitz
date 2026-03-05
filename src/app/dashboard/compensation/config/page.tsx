export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export default async function CompensationConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const configs = await db.stackConfig.findMany({
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    include: {
      carrier: { select: { id: true, name: true } },
      market: { select: { id: true, name: true } },
    },
  });

  type ConfigItem = (typeof configs)[number];
  // Group by carrier
  const byCarrier = configs.reduce<Record<string, ConfigItem[]>>((acc, config) => {
    const key = config.carrierId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(config);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stack Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View compensation stack configurations by carrier and market. Manage configs in Admin &rarr; Stack Configs.
        </p>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              No stack configurations found. Create them in Admin &rarr; Stack Configs.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(byCarrier).map(([, carrierConfigs]: [string, ConfigItem[]]) => {
          const carrierName = carrierConfigs[0].carrier.name;
          return (
            <Card key={carrierConfigs[0].carrierId}>
              <CardHeader>
                <CardTitle className="text-base">{carrierName}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Market</TableHead>
                      <TableHead>Company Floor %</TableHead>
                      <TableHead>Manager Override %</TableHead>
                      <TableHead>Market Owner Spread %</TableHead>
                      <TableHead>Rep Pay % (Remaining)</TableHead>
                      <TableHead>Effective Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carrierConfigs.map((config) => {
                      const repPayPct =
                        100 -
                        config.companyFloorPercent -
                        config.managerOverridePercent -
                        config.marketOwnerSpreadPercent;
                      return (
                        <TableRow key={config.id}>
                          <TableCell className="text-sm font-medium">
                            {config.market?.name ?? (
                              <span className="text-muted-foreground italic">All markets</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {config.companyFloorPercent}%
                          </TableCell>
                          <TableCell className="text-sm">
                            {config.managerOverridePercent}%
                          </TableCell>
                          <TableCell className="text-sm">
                            {config.marketOwnerSpreadPercent}%
                          </TableCell>
                          <TableCell className="text-sm font-medium text-green-700">
                            {repPayPct.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(config.effectiveDate), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
