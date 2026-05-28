"use client";

import * as React from "react";
import { format } from "date-fns";
import { BarChart3, Users, Target, PhoneCall, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type VisitOutcome = "NOT_HOME" | "NOT_INTERESTED" | "CALLBACK" | "SALE";

interface Visit {
  id: string;
  address: string;
  outcome: VisitOutcome;
  notes: string | null;
  createdAt: string;
  rep: { id: string; name: string | null; email: string };
}

interface Stats {
  totalKnocks: number;
  sales: number;
  callbacks: number;
  conversionRate: number;
  leaderboard: { repId: string; repName: string; knocks: number; sales: number }[];
}

const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  NOT_HOME: "Not Home",
  NOT_INTERESTED: "Not Interested",
  CALLBACK: "Callback",
  SALE: "Sale",
};

const OUTCOME_VARIANTS: Record<VisitOutcome, "secondary" | "destructive" | "outline" | "default"> = {
  NOT_HOME: "secondary",
  NOT_INTERESTED: "destructive",
  CALLBACK: "outline",
  SALE: "default",
};

export default function ManagerVisitDashboardPage() {
  const [visits, setVisits] = React.useState<Visit[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dateFilter, setDateFilter] = React.useState("");
  const [repFilter, setRepFilter] = React.useState("");

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (repFilter) params.set("repId", repFilter);

    const statsParams = new URLSearchParams();
    if (dateFilter) statsParams.set("date", dateFilter);

    const [visitsRes, statsRes] = await Promise.all([
      fetch(`/api/visits?${params.toString()}`),
      fetch(`/api/visits/stats?${statsParams.toString()}`),
    ]);

    if (visitsRes.ok) setVisits(await visitsRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }

  React.useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, repFilter]);

  // Derive unique reps from visits for filter dropdown
  const repOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    visits.forEach((v) => {
      seen.set(v.rep.id, v.rep.name ?? v.rep.email);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [visits]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visit Dashboard</h1>
          <p className="text-sm text-muted-foreground">All rep activity across your team</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Reps</option>
          {repOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {(dateFilter || repFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFilter("");
              setRepFilter("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Knocks</span>
              </div>
              <p className="text-3xl font-bold">{stats.totalKnocks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Sales</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.sales}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <PhoneCall className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Callbacks</span>
              </div>
              <p className="text-3xl font-bold text-amber-600">{stats.callbacks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Conv. Rate</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats.conversionRate}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main content: leaderboard + visit table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        {stats && stats.leaderboard.length > 0 && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {stats.leaderboard.map((row, idx) => (
                    <div
                      key={row.repId}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium truncate">{row.repName}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-sm">
                        <span className="text-muted-foreground">{row.knocks}k</span>
                        <span className="text-green-600 font-semibold">{row.sales}s</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">k = knocks · s = sales</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Visit log table */}
        <div className={stats && stats.leaderboard.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Visit Log</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2 py-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ) : visits.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No visits found{dateFilter ? " for this date" : ""}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Rep
                        </th>
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Address
                        </th>
                        <th className="text-left py-2 pr-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Outcome
                        </th>
                        <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => (
                        <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 font-medium whitespace-nowrap">
                            {v.rep.name ?? v.rep.email}
                          </td>
                          <td className="py-2 pr-3 max-w-[200px] truncate text-muted-foreground">
                            {v.address}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant={OUTCOME_VARIANTS[v.outcome]} className="text-xs">
                              {OUTCOME_LABELS[v.outcome]}
                            </Badge>
                          </td>
                          <td className="py-2 text-muted-foreground whitespace-nowrap">
                            {format(new Date(v.createdAt), "MMM d, h:mm a")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
