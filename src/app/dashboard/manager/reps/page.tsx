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
import { AlertTriangle, Users, TrendingUp, TrendingDown } from "lucide-react";

export default async function ManagerRepsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const reps = await db.user.findMany({
    where: { role: "FIELD_REP" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      governanceTier: { select: { id: true, name: true, rank: true } },
      governancePeriods: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 3,
        select: {
          installRate: true,
          isStrike: true,
          consecutiveStrikes: true,
        },
      },
      blitzAssignments: {
        where: { status: { in: ["ASSIGNED", "CONFIRMED", "ACTIVE"] } },
        select: { blitz: { select: { id: true, name: true, status: true } } },
      },
      complianceHolds: {
        where: { restoredDate: null },
        select: { id: true },
      },
      _count: {
        select: {
          goBacksRecorded: {
            where: { status: "SCHEDULED" },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Compute stats
  const activeReps = reps.filter((r) => r.status === "ACTIVE").length;
  const allInstallRates = reps
    .map((r) => r.governancePeriods[0]?.installRate ?? 0)
    .filter((r) => r > 0);
  const avgInstallRate =
    allInstallRates.length > 0
      ? Math.round(
          (allInstallRates.reduce((a, b) => a + b, 0) / allInstallRates.length) *
            100
        )
      : 0;

  const stats = [
    { label: "Total Reps", value: reps.length, icon: Users },
    { label: "Active Reps", value: activeReps, icon: TrendingUp },
    { label: "Avg Install Rate", value: `${avgInstallRate}%`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rep Oversight</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor rep performance, governance status, and compliance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <stat.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reps Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Reps</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reps.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No field reps found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep Name</TableHead>
                  <TableHead>Active Blitz</TableHead>
                  <TableHead>Install Rate</TableHead>
                  <TableHead>Strikes</TableHead>
                  <TableHead>Go-Backs Pending</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((rep) => {
                  const latestPeriod = rep.governancePeriods[0];
                  const installRate = latestPeriod?.installRate ?? 0;
                  const installRatePct = Math.round(installRate * 100);
                  const strikes = latestPeriod?.consecutiveStrikes ?? 0;
                  const hasCompliance = rep.complianceHolds.length > 0;
                  const activeBlitz = rep.blitzAssignments[0]?.blitz;
                  const isAtRisk = installRatePct < 70 || strikes > 0;

                  return (
                    <TableRow key={rep.id} className={isAtRisk ? "bg-red-50/50" : ""}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          {isAtRisk && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          {rep.name ?? rep.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {activeBlitz ? (
                          <span className="text-primary">{activeBlitz.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {installRatePct >= 80 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                          ) : installRatePct > 0 ? (
                            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                          ) : null}
                          <span
                            className={`text-sm ${
                              installRatePct >= 80
                                ? "text-green-600"
                                : installRatePct > 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {installRatePct > 0 ? `${installRatePct}%` : "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {strikes > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-100 text-amber-700"
                          >
                            {strikes} strike{strikes > 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {rep._count.goBacksRecorded > 0 ? (
                          <span className="font-medium text-amber-600">
                            {rep._count.goBacksRecorded}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {hasCompliance ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-red-100 text-red-700"
                          >
                            On Hold
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-100 text-green-700"
                          >
                            Clear
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {rep.governanceTier ? (
                          <Badge variant="secondary" className="text-xs">
                            {rep.governanceTier.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAtRisk ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-100 text-amber-700"
                          >
                            At Risk
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
