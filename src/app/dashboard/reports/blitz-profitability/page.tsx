"use client";

import * as React from "react";
import { DollarSign, TrendingUp, Users, BarChart2 } from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { BarChart } from "@/components/charts/bar-chart";
import { DataTable } from "@/components/tables/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BlitzData {
  id: string;
  name: string;
  market: string;
  carrier: string;
  status: string;
  revenue: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  verifiedInstalls: number;
  repCount: number;
  revenuePerRep: number;
  installsPerRep: number;
}

interface ProfitabilityData {
  blitzes: BlitzData[];
  top10ByProfit: BlitzData[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "text-slate-600 border-slate-400",
  ACTIVE: "text-green-700 border-green-500",
  COMPLETED: "text-blue-700 border-blue-400",
  CANCELLED: "text-red-700 border-red-400",
};

export default function BlitzProfitabilityPage() {
  const [data, setData] = React.useState<ProfitabilityData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/reports/blitz-profitability")
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
        Loading blitz profitability data...
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

  const totalRevenue = data.blitzes.reduce((s, b) => s + b.revenue, 0);
  const totalProfit = data.blitzes.reduce((s, b) => s + b.profit, 0);
  const totalInstalls = data.blitzes.reduce((s, b) => s + b.verifiedInstalls, 0);
  const avgMargin =
    data.blitzes.length > 0
      ? Math.round(
          data.blitzes.reduce((s, b) => s + b.marginPercent, 0) /
            data.blitzes.length
        )
      : 0;

  const chartData = data.top10ByProfit.map((b) => ({
    name: b.name.length > 12 ? b.name.slice(0, 12) + "…" : b.name,
    Profit: b.profit,
  }));

  const tableData = data.blitzes.map((b) => ({
    ...b,
    revenueDisplay: formatCurrency(b.revenue),
    expensesDisplay: formatCurrency(b.expenses),
    profitDisplay: formatCurrency(b.profit),
    marginDisplay: `${b.marginPercent}%`,
    revenuePerRepDisplay: formatCurrency(b.revenuePerRep),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Blitz P&L Comparison</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Profit and loss breakdown by blitz event.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Profit"
          value={formatCurrency(totalProfit)}
        />
        <StatCard
          icon={BarChart2}
          label="Avg Margin"
          value={`${avgMargin}%`}
        />
        <StatCard
          icon={Users}
          label="Total Installs"
          value={totalInstalls}
        />
      </div>

      {/* Top 10 Bar Chart */}
      {chartData.length > 0 && (
        <BarChart
          data={chartData as Record<string, unknown>[]}
          xKey="name"
          yKey="Profit"
          title="Top 10 Blitzes by Profit"
          color="#10b981"
        />
      )}

      {/* Full DataTable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All Blitzes ({data.blitzes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-6">
          <DataTable
            data={tableData as Record<string, unknown>[]}
            columns={[
              { key: "name", label: "Blitz", sortable: true },
              { key: "market", label: "Market" },
              {
                key: "status",
                label: "Status",
                render: (val) => (
                  <Badge
                    variant="outline"
                    className={STATUS_COLORS[val as string] ?? ""}
                  >
                    {val as string}
                  </Badge>
                ),
              },
              { key: "repCount", label: "Reps", sortable: true },
              { key: "verifiedInstalls", label: "Installs", sortable: true },
              { key: "revenueDisplay", label: "Revenue" },
              { key: "expensesDisplay", label: "Expenses" },
              {
                key: "profitDisplay",
                label: "Profit",
                render: (val, row) => (
                  <span
                    className={
                      ((row as unknown) as BlitzData).profit >= 0
                        ? "text-emerald-600 font-semibold"
                        : "text-destructive font-semibold"
                    }
                  >
                    {val as string}
                  </span>
                ),
              },
              {
                key: "marginDisplay",
                label: "Margin %",
                sortable: false,
                render: (val, row) => {
                  const margin = ((row as unknown) as BlitzData).marginPercent;
                  return (
                    <span
                      className={
                        margin >= 30
                          ? "text-emerald-600 font-medium"
                          : margin >= 15
                            ? "text-amber-500 font-medium"
                            : "text-destructive font-medium"
                      }
                    >
                      {val as string}
                    </span>
                  );
                },
              },
              { key: "revenuePerRepDisplay", label: "Rev / Rep" },
            ]}
            searchable
            searchKeys={["name", "market", "status"]}
            pagination
            pageSize={15}
            emptyMessage="No blitz data available."
          />
        </CardContent>
      </Card>
    </div>
  );
}
