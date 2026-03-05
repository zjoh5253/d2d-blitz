"use client";

import * as React from "react";
import { Users, CheckCircle, DollarSign, Activity, Map, TrendingUp } from "lucide-react";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  gradientClass?: string;
  delay?: string;
}

function KpiCard({ icon: Icon, label, value, iconBg, iconColor, delay }: KpiCardProps) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-5 animate-fade-in relative overflow-hidden"
      style={{ animationDelay: delay ?? "0ms" }}
    >
      {/* Subtle decorative gradient blob */}
      <div
        className={cn(
          "absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-10 blur-xl",
          iconBg
        )}
      />
      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight font-heading text-foreground">
            {value}
          </p>
        </div>
        <div className={cn("rounded-xl p-3 shrink-0", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
    </div>
  );
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
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-sm text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Loading national summary...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-destructive">
        {error ?? "Failed to load data"}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Page header */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight font-heading text-foreground">
            National Summary
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Aggregate performance across all markets and blitzes.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={CheckCircle}
          label="Verified Installs"
          value={data.stats.totalVerifiedInstalls.toLocaleString()}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          delay="0ms"
        />
        <KpiCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(data.stats.totalRevenue)}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          delay="60ms"
        />
        <KpiCard
          icon={Users}
          label="Active Reps"
          value={data.stats.activeReps.toLocaleString()}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          delay="120ms"
        />
        <KpiCard
          icon={Activity}
          label="Active Blitzes"
          value={data.stats.activeBlitzes.toLocaleString()}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          delay="180ms"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="animate-fade-in" style={{ animationDelay: "80ms" }}>
          <LineChart
            data={data.monthlyInstalls}
            xKey="month"
            yKey="installs"
            title="Installs Over Time (Monthly)"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "120ms" }}>
          <BarChart
            data={data.byCarrier}
            xKey="carrier"
            yKey="installs"
            title="Installs by Carrier"
          />
        </div>
      </div>

      {/* Map Placeholder */}
      <Card className="animate-fade-in overflow-hidden" style={{ animationDelay: "160ms" }}>
        <CardHeader className="border-b border-border bg-muted/30 py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-primary/10 inline-flex items-center justify-center">
              <Map className="h-3 w-3 text-primary" />
            </div>
            Market Coverage Map
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex h-56 items-center justify-center bg-gradient-to-br from-blue-50/50 to-slate-50">
            <div className="text-center">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Map className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">
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
