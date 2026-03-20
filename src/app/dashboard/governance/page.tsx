export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/charts/stat-card";
import { PieChart } from "@/components/charts/pie-chart";
import { Users, AlertTriangle, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GovernanceTable } from "./governance-table";

export default async function GovernancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Get all FIELD_REPs with their governance tier and periods
  const reps = await db.user.findMany({
    where: { role: "FIELD_REP" },
    include: {
      governanceTier: true,
      governancePeriods: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 1,
      },
    },
  });

  const tiers = await db.governanceTier.findMany({ orderBy: { rank: "asc" } });

  // Compute stats
  const totalReps = reps.length;
  const repsWithStrikes = reps.filter(
    (r) => (r.governancePeriods[0]?.consecutiveStrikes ?? 0) > 0
  ).length;

  // Upcoming reviews: reps who have 1 consecutive strike (warning)
  const upcomingReviews = reps.filter(
    (r) => (r.governancePeriods[0]?.consecutiveStrikes ?? 0) === 1
  ).length;

  // Tier distribution for pie chart
  const tierDistribution = tiers.map((tier) => ({
    name: tier.name,
    value: reps.filter((r) => r.governanceTierId === tier.id).length,
  }));

  // Table data
  const tableData = reps.map((rep) => {
    const latestPeriod = rep.governancePeriods[0];
    return {
      id: rep.id,
      name: rep.name ?? rep.email,
      tier: rep.governanceTier?.name ?? "Unassigned",
      installRate: latestPeriod
        ? `${(latestPeriod.installRate * 100).toFixed(1)}%`
        : "N/A",
      strikes: latestPeriod?.consecutiveStrikes ?? 0,
      lastReview: latestPeriod
        ? `${latestPeriod.month}/${latestPeriod.year}`
        : "Never",
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Governance</h1>
          <p className="text-muted-foreground text-sm">
            Monitor rep performance tiers and compliance status
          </p>
        </div>
        <Link href="/dashboard/admin/governance">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Configure Tiers
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Total Field Reps" value={totalReps} />
        <StatCard
          icon={AlertTriangle}
          label="Reps with Strikes"
          value={repsWithStrikes}
        />
        <StatCard
          icon={Clock}
          label="Upcoming Reviews"
          value={upcomingReviews}
        />
      </div>

      {/* Tier Distribution + Table */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PieChart
            data={tierDistribution.filter((d) => d.value > 0)}
            nameKey="name"
            valueKey="value"
            title="Tier Distribution"
          />
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rep Governance Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6">
              <GovernanceTable data={tableData as Record<string, unknown>[]} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
