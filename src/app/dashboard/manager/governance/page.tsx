export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ShieldAlert, TrendingDown } from "lucide-react";

export default async function ManagerGovernancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const reps = await db.user.findMany({
    where: { role: "FIELD_REP", status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      email: true,
      governanceTier: { select: { name: true, rank: true, minInstallRate: true } },
      governancePeriods: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 3,
        select: {
          month: true,
          year: true,
          installRate: true,
          isStrike: true,
          consecutiveStrikes: true,
          tier: { select: { name: true } },
        },
      },
    },
  });

  // Tier thresholds for risk detection
  const tiers = await db.governanceTier.findMany({
    orderBy: { rank: "asc" },
  });

  const defaultTier = tiers.find((t) => t.isDefault);
  const thresholdRate = defaultTier?.minInstallRate ?? 0.7;

  // Classify reps
  const repsWithStrikes = reps.filter(
    (r) =>
      (r.governancePeriods[0]?.consecutiveStrikes ?? 0) > 0 ||
      r.governancePeriods[0]?.isStrike
  );

  const repsAtRiskOfTierReduction = reps.filter((r) => {
    const rate = r.governancePeriods[0]?.installRate ?? 1;
    const tier = r.governanceTier;
    if (!tier) return false;
    return rate < tier.minInstallRate && rate > 0;
  });

  const earlyInterventionFlags = reps.filter((r) => {
    if (r.governancePeriods.length < 2) return false;
    const recent = r.governancePeriods.slice(0, 2);
    // Trending downward AND below global threshold
    return (
      recent[0].installRate < recent[1].installRate &&
      recent[0].installRate < thresholdRate
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Governance Risk View</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Early intervention flags, strike tracking, and tier risk monitoring.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{repsWithStrikes.length}</p>
                <p className="text-xs text-muted-foreground">Reps with Strikes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {repsAtRiskOfTierReduction.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  At Risk of Tier Reduction
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {earlyInterventionFlags.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Early Intervention Flags
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reps with Strikes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Reps with Active Strikes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {repsWithStrikes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No reps with active strikes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Current Tier</TableHead>
                  <TableHead>Install Rate</TableHead>
                  <TableHead>Consecutive Strikes</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repsWithStrikes.map((rep) => {
                  const period = rep.governancePeriods[0];
                  return (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium text-sm">
                        {rep.name ?? rep.email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rep.governanceTier?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 font-medium">
                        {period
                          ? `${Math.round(period.installRate * 100)}%`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-100 text-amber-700"
                        >
                          {period?.consecutiveStrikes ?? 0} strike
                          {(period?.consecutiveStrikes ?? 0) !== 1 ? "s" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/reps/${rep.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* At Risk of Tier Reduction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            At Risk of Tier Reduction
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {repsAtRiskOfTierReduction.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No reps at risk of tier reduction.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Current Tier</TableHead>
                  <TableHead>Install Rate</TableHead>
                  <TableHead>Min Required</TableHead>
                  <TableHead>Gap</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repsAtRiskOfTierReduction.map((rep) => {
                  const period = rep.governancePeriods[0];
                  const rate = period?.installRate ?? 0;
                  const minRate = rep.governanceTier?.minInstallRate ?? 0;
                  const gap = Math.round((minRate - rate) * 100);

                  return (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium text-sm">
                        {rep.name ?? rep.email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rep.governanceTier?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 font-medium">
                        {Math.round(rate * 100)}%
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Math.round(minRate * 100)}%
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs bg-red-100 text-red-700"
                        >
                          -{gap}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/reps/${rep.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Early Intervention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Early Intervention Flags
            <span className="text-xs text-muted-foreground font-normal ml-1">
              (reps trending below threshold)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {earlyInterventionFlags.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No early intervention flags.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>This Month</TableHead>
                  <TableHead>Last Month</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earlyInterventionFlags.map((rep) => {
                  const [current, prev] = rep.governancePeriods;
                  const currentRate = Math.round((current?.installRate ?? 0) * 100);
                  const prevRate = Math.round((prev?.installRate ?? 0) * 100);
                  const diff = currentRate - prevRate;

                  return (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium text-sm">
                        {rep.name ?? rep.email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rep.governanceTier?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 font-medium">
                        {currentRate}%
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {prevRate}%
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs bg-orange-100 text-orange-700"
                        >
                          {diff}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/reps/${rep.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
