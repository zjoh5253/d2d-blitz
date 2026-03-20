"use client";

import * as React from "react";
import { Users, ShieldAlert, Percent } from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { PieChart } from "@/components/charts/pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface GovernanceData {
  tierDistribution: Array<{ tier: string; count: number }>;
  tierTrend: Array<Record<string, unknown>>;
  stats: {
    totalReps: number;
    totalStrikes: number;
    strikeRate: number;
  };
  tierDetails: Array<{
    id: string;
    name: string;
    rank: number;
    minInstallRate: number;
    commissionMultiplier: number;
    repCount: number;
  }>;
}

export default function GovernanceReportPage() {
  const [data, setData] = React.useState<GovernanceData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/reports/governance")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load data");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Loading governance data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-destructive">
        {error ?? "Failed to load data"}
      </div>
    );
  }

  // Build trend lines from tier names
  const tierNames = data.tierDetails.map((t) => t.name);
  const TIER_COLORS = [
    "hsl(var(--primary))",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#06B6D4",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Governance Distribution</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Rep tier distribution, strike rates, and governance health.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Total Active Reps"
          value={data.stats.totalReps}
        />
        <StatCard
          icon={ShieldAlert}
          label="Reps with Strikes"
          value={data.stats.totalStrikes}
        />
        <StatCard
          icon={Percent}
          label="Strike Rate"
          value={`${data.stats.strikeRate}%`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PieChart
          data={data.tierDistribution}
          nameKey="tier"
          valueKey="count"
          title="Reps by Tier"
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tier Distribution Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {data.tierTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RechartsLineChart
                  data={data.tierTrend as Record<string, unknown>[]}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} />
                  {tierNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      name={name}
                      stroke={TIER_COLORS[i % TIER_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                Not enough historical data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tier Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Rank</TableHead>
                <TableHead className="text-right">Min Install Rate</TableHead>
                <TableHead className="text-right">Commission Multiplier</TableHead>
                <TableHead className="text-right">Reps</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tierDetails.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {tier.name}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {tier.rank}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {Math.round(tier.minInstallRate * 100)}%
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {tier.commissionMultiplier.toFixed(2)}x
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium">
                    {tier.repCount}
                  </TableCell>
                  <TableCell className="text-sm text-right text-muted-foreground">
                    {data.stats.totalReps > 0
                      ? `${Math.round((tier.repCount / data.stats.totalReps) * 100)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
