"use client";

import * as React from "react";
import { Users, TrendingUp, Clock, Award } from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { BarChart } from "@/components/charts/bar-chart";
import { DataTable } from "@/components/tables/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SourceData {
  source: string;
  leads: number;
  onboarded: number;
  conversionPercent: number;
  avgDaysToOnboard: number | null;
}

interface RecruitingROIData {
  stats: {
    totalLeads: number;
    onboarded: number;
    conversionRate: number;
    avgDaysToFirstSale: number | null;
  };
  bySource: SourceData[];
}

export default function RecruitingROIPage() {
  const [data, setData] = React.useState<RecruitingROIData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/reports/recruiting-roi")
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
        Loading recruiting ROI data...
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

  const chartData = data.bySource.map((s) => ({
    source: s.source,
    Onboarded: s.onboarded,
    Leads: s.leads,
  }));

  const tableData = data.bySource.map((s) => ({
    ...s,
    conversionDisplay: `${s.conversionPercent}%`,
    avgDaysDisplay:
      s.avgDaysToOnboard !== null ? `${s.avgDaysToOnboard}d` : "—",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recruiting ROI</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Lead conversion rates and source effectiveness analysis.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Leads" value={data.stats.totalLeads} />
        <StatCard
          icon={Award}
          label="Onboarded"
          value={data.stats.onboarded}
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion Rate"
          value={`${data.stats.conversionRate}%`}
        />
        <StatCard
          icon={Clock}
          label="Avg Days to First Sale"
          value={
            data.stats.avgDaysToFirstSale !== null
              ? `${data.stats.avgDaysToFirstSale}d`
              : "—"
          }
        />
      </div>

      {/* Bar Chart by source */}
      {chartData.length > 0 && (
        <BarChart
          data={chartData as Record<string, unknown>[]}
          xKey="source"
          yKey="Onboarded"
          title="Onboarded Reps by Source"
          color="hsl(var(--primary))"
        />
      )}

      {/* Source Effectiveness Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Effectiveness</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-6">
          <DataTable
            data={tableData as Record<string, unknown>[]}
            columns={[
              { key: "source", label: "Source", sortable: true },
              { key: "leads", label: "Total Leads", sortable: true },
              { key: "onboarded", label: "Onboarded", sortable: true },
              {
                key: "conversionDisplay",
                label: "Conversion %",
                sortable: false,
                render: (val, row) => {
                  const pct = ((row as unknown) as SourceData).conversionPercent;
                  return (
                    <span
                      className={
                        pct >= 40
                          ? "text-emerald-600 font-semibold"
                          : pct >= 20
                            ? "text-amber-500 font-semibold"
                            : "text-destructive font-semibold"
                      }
                    >
                      {val as string}
                    </span>
                  );
                },
              },
              { key: "avgDaysDisplay", label: "Avg Days to Onboard" },
            ]}
            searchable
            searchKeys={["source"]}
            emptyMessage="No recruiting data available."
          />
        </CardContent>
      </Card>
    </div>
  );
}
