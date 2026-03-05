"use client";

import * as React from "react";
import { Users, CheckCircle, DollarSign, Activity, Map } from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NationalData {
  stats: {
    totalVerifiedInstalls: number;
    totalRevenue: number;
    activeReps: number;
    activeBlitzes: number;
  };
  monthlyInstalls: Array<{ month: string; installs: number }>;
  byCarrier: Array<{ carrier: string; installs: number }>;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function NationalReportPage() {
  const [data, setData] = React.useState<NationalData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/reports/national")
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
        Loading national summary...
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">National Install Summary</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aggregate performance across all markets and blitzes.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle}
          label="Verified Installs"
          value={data.stats.totalVerifiedInstalls.toLocaleString()}
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(data.stats.totalRevenue)}
        />
        <StatCard
          icon={Users}
          label="Active Reps"
          value={data.stats.activeReps.toLocaleString()}
        />
        <StatCard
          icon={Activity}
          label="Active Blitzes"
          value={data.stats.activeBlitzes.toLocaleString()}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LineChart
          data={data.monthlyInstalls}
          xKey="month"
          yKey="installs"
          title="Installs Over Time (Monthly)"
        />
        <BarChart
          data={data.byCarrier}
          xKey="carrier"
          yKey="installs"
          title="Installs by Carrier"
        />
      </div>

      {/* Map Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="h-4 w-4" />
            Market Coverage Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/30">
            <div className="text-center">
              <Map className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                Market Coverage Map
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Geographic visualization coming soon
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
