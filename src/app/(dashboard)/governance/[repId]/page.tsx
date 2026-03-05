export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { LineChart } from "@/components/charts/line-chart";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User } from "lucide-react";

export default async function RepGovernancePage({
  params,
}: {
  params: Promise<{ repId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { repId } = await params;

  const rep = await db.user.findUnique({
    where: { id: repId },
    include: {
      governanceTier: true,
      governancePeriods: {
        orderBy: [{ year: "asc" }, { month: "asc" }],
        include: {
          tier: { select: { id: true, name: true, rank: true } },
        },
      },
    },
  });

  if (!rep || rep.role !== "FIELD_REP") notFound();

  const latestPeriod = [...rep.governancePeriods].reverse()[0];

  // Table rows for monthly periods
  const periodRows = rep.governancePeriods.map((p) => ({
    period: `${String(p.month).padStart(2, "0")}/${p.year}`,
    submittedInstalls: p.submittedInstalls,
    verifiedInstalls: p.verifiedInstalls,
    installRate: `${(p.installRate * 100).toFixed(1)}%`,
    tier: p.tier.name,
    strike: p.isStrike,
    consecutiveStrikes: p.consecutiveStrikes,
  }));

  // Chart data: install rate over time
  const chartData = rep.governancePeriods.map((p) => ({
    period: `${String(p.month).padStart(2, "0")}/${p.year}`,
    "Install Rate": Math.round(p.installRate * 100),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/governance"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {rep.name ?? rep.email}
          </h1>
          <p className="text-sm text-muted-foreground">Governance History</p>
        </div>
      </div>

      {/* Rep Info Card */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Rep Info</p>
                <p className="font-semibold">{rep.name ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{rep.email}</p>
                {rep.phone && (
                  <p className="text-sm text-muted-foreground">{rep.phone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Current Tier</p>
            <Badge variant="outline" className="text-base px-3 py-1">
              {rep.governanceTier?.name ?? "Unassigned"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Current Status</p>
            {latestPeriod ? (
              <div className="space-y-1">
                <p className="font-semibold">
                  {latestPeriod.consecutiveStrikes >= 2 ? (
                    <span className="text-destructive">Suspended</span>
                  ) : latestPeriod.isStrike ? (
                    <span className="text-amber-500">Warning</span>
                  ) : (
                    <span className="text-emerald-500">Good Standing</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {latestPeriod.consecutiveStrikes} consecutive strike
                  {latestPeriod.consecutiveStrikes !== 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No periods yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Install rate chart */}
      {chartData.length > 0 && (
        <LineChart
          data={chartData}
          xKey="period"
          yKey="Install Rate"
          title="Install Rate Over Time (%)"
        />
      )}

      {/* Periods Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Governance Periods</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-6">
          <DataTable
            data={periodRows as Record<string, unknown>[]}
            columns={[
              { key: "period", label: "Month/Year", sortable: true },
              { key: "submittedInstalls", label: "Submitted", sortable: true },
              { key: "verifiedInstalls", label: "Verified", sortable: true },
              { key: "installRate", label: "Install Rate", sortable: true },
              {
                key: "tier",
                label: "Tier",
                render: (val) => (
                  <Badge variant="outline">{val as string}</Badge>
                ),
              },
              {
                key: "strike",
                label: "Strike",
                render: (val, row) => {
                  const isStrike = val as boolean;
                  const consec = (row as { consecutiveStrikes: number })
                    .consecutiveStrikes;
                  return isStrike ? (
                    <Badge variant="destructive">
                      Strike ({consec})
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-600"
                    >
                      Clear
                    </Badge>
                  );
                },
              },
            ]}
            pagination
            pageSize={12}
            emptyMessage="No governance periods recorded yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
