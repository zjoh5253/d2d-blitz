"use client";

import * as React from "react";
import { TrendingUp, DollarSign, Percent } from "lucide-react";
import { StatCard } from "@/components/charts/stat-card";
import { LineChart } from "@/components/charts/line-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MarginsData {
  stats: {
    overallMargin: number;
    totalRevenue: number;
    totalExpenses: number;
    highestMarginCarrier: string;
    lowestMarginCarrier: string;
  };
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    margin: number;
  }>;
  carrierBreakdown: Array<{
    carrier: string;
    revenue: number;
    installs: number;
    margin: number;
  }>;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function MarginsReportPage() {
  const [data, setData] = React.useState<MarginsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/reports/margins")
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
        Loading margin data...
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
        <h1 className="text-2xl font-bold">Margin Protection</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Revenue vs expenses analysis and margin tracking over time.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Percent}
          label="Overall Margin"
          value={`${data.stats.overallMargin}%`}
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(data.stats.totalRevenue)}
        />
        <StatCard
          icon={DollarSign}
          label="Total Expenses"
          value={formatCurrency(data.stats.totalExpenses)}
        />
        <StatCard
          icon={TrendingUp}
          label="Highest Margin Carrier"
          value={data.stats.highestMarginCarrier}
        />
      </div>

      {/* Revenue vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue vs Expenses Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLine
              data={data.monthlyData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={(v: number) =>
                  `$${(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: unknown) => [formatCurrency(Number(value))]}
              />
              <Legend iconType="circle" iconSize={8} />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
            </RechartsLine>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Margin % trend */}
      <LineChart
        data={data.monthlyData}
        xKey="month"
        yKey="margin"
        title="Margin % Trend"
        color="#10b981"
      />

      {/* Carrier Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By-Carrier Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.carrierBreakdown.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No carrier data available.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead className="text-right">Installs</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.carrierBreakdown.map((row) => (
                  <TableRow key={row.carrier}>
                    <TableCell className="font-medium text-sm">
                      {row.carrier}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {row.installs.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {formatCurrency(row.revenue)}
                    </TableCell>
                    <TableCell
                      className={`text-sm text-right font-medium ${
                        row.margin >= 30
                          ? "text-green-600"
                          : row.margin >= 15
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {row.margin}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
