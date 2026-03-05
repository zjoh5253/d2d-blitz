"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Award, Star } from "lucide-react";

type Period = "week" | "month" | "season" | "lifetime";

interface LeaderboardRow {
  rank: number;
  repId: string;
  repName: string;
  verifiedInstalls: number;
  sales: number;
  installRate: number;
  tier: string | null;
}

interface Market {
  id: string;
  name: string;
}

interface Blitz {
  id: string;
  name: string;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "This Week",
  month: "This Month",
  season: "This Season",
  lifetime: "Lifetime",
};

const RANK_STYLES = [
  "bg-amber-50 border-l-4 border-l-amber-400 dark:bg-amber-950/30",
  "bg-slate-50 border-l-4 border-l-slate-400 dark:bg-slate-900/30",
  "bg-orange-50 border-l-4 border-l-orange-300 dark:bg-orange-950/30",
];

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface PodiumCardProps {
  row: LeaderboardRow;
  place: 1 | 2 | 3;
}

function PodiumCard({ row, place }: PodiumCardProps) {
  const configs = {
    1: {
      ring: "ring-2 ring-[#F59E0B] shadow-lg shadow-amber-100",
      avatarBg: "from-amber-400 to-amber-600",
      avatarText: "text-white",
      badge: "bg-amber-400 text-amber-950",
      installColor: "text-amber-600",
      icon: <Trophy className="h-4 w-4 text-amber-500" />,
      label: "1st Place",
      labelColor: "text-amber-600",
      size: "h-16 w-16 text-xl",
      padding: "p-5",
    },
    2: {
      ring: "ring-2 ring-slate-300",
      avatarBg: "from-slate-400 to-slate-600",
      avatarText: "text-white",
      badge: "bg-slate-300 text-slate-800",
      installColor: "text-slate-600",
      icon: <Medal className="h-4 w-4 text-slate-400" />,
      label: "2nd Place",
      labelColor: "text-slate-500",
      size: "h-14 w-14 text-lg",
      padding: "p-4",
    },
    3: {
      ring: "ring-2 ring-[#CD7F32]",
      avatarBg: "from-orange-400 to-orange-600",
      avatarText: "text-white",
      badge: "bg-orange-300 text-orange-900",
      installColor: "text-orange-600",
      icon: <Award className="h-4 w-4 text-orange-500" />,
      label: "3rd Place",
      labelColor: "text-orange-600",
      size: "h-14 w-14 text-lg",
      padding: "p-4",
    },
  };

  const c = configs[place];

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-2xl flex flex-col items-center text-center",
        c.ring,
        c.padding,
        "animate-fade-in",
        place === 1 ? "animate-stagger-1" : place === 2 ? "animate-stagger-2" : "animate-stagger-3"
      )}
    >
      {/* Place label */}
      <div className={cn("flex items-center gap-1.5 mb-3 text-xs font-semibold uppercase tracking-wide", c.labelColor)}>
        {c.icon}
        {c.label}
      </div>

      {/* Avatar circle */}
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold shrink-0 bg-gradient-to-br",
          c.size,
          c.avatarBg,
          c.avatarText,
          "mb-3 font-heading"
        )}
      >
        {getInitials(row.repName)}
      </div>

      {/* Name */}
      <p className="font-bold text-foreground font-heading text-base leading-tight mb-0.5">
        {row.repName}
      </p>

      {/* Installs */}
      <p className={cn("text-2xl font-bold font-heading tracking-tight", c.installColor)}>
        {row.verifiedInstalls}
      </p>
      <p className="text-xs text-muted-foreground font-medium">verified installs</p>

      {/* Tier badge */}
      {row.tier && (
        <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <Star className="h-2.5 w-2.5" />
          {row.tier}
        </span>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-bold text-sm">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-bold text-sm">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-300 text-orange-900 font-bold text-sm">
        3
      </span>
    );
  return <span className="text-sm font-medium text-muted-foreground tabular-nums">{rank}</span>;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [marketId, setMarketId] = useState<string>("all");
  const [blitzId, setBlitzId] = useState<string>("all");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [blitzes, setBlitzes] = useState<Blitz[]>([]);
  const [loading, setLoading] = useState(false);

  // Load markets and blitzes for filters
  useEffect(() => {
    async function loadFilters() {
      const [mRes, bRes] = await Promise.all([
        fetch("/api/markets"),
        fetch("/api/blitzes"),
      ]);
      if (mRes.ok) setMarkets(await mRes.json());
      if (bRes.ok) setBlitzes(await bRes.json());
    }
    loadFilters().catch(console.error);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (marketId !== "all") params.set("marketId", marketId);
      if (blitzId !== "all") params.set("blitzId", blitzId);

      const res = await fetch(`/api/leaderboard?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows);
      }
    } finally {
      setLoading(false);
    }
  }, [period, marketId, blitzId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const tableData = rows.map((row) => ({
    ...row,
    installRateDisplay: `${(row.installRate * 100).toFixed(1)}%`,
    _rowStyle: row.rank <= 3 ? RANK_STYLES[row.rank - 1] : "",
  })) as Record<string, unknown>[];

  const top3 = rows.slice(0, 3);
  const remaining = rows.filter((r) => r.rank > 3);

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h1 className="text-3xl font-bold tracking-tight font-heading text-foreground">
              Leaderboard
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Top performers ranked by verified installs
          </p>
        </div>

        {/* Filters inline */}
        <div className="flex gap-2 flex-wrap">
          <Select
            className="w-40"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
          >
            <option value="all">All Markets</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>

          <Select
            className="w-40"
            value={blitzId}
            onChange={(e) => setBlitzId(e.target.value)}
          >
            <option value="all">All Blitzes</option>
            {blitzes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Period pill tabs */}
      <div className="flex gap-1.5 flex-wrap animate-fade-in" style={{ animationDelay: "40ms" }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-150 border",
              period === p
                ? "bg-primary text-white border-primary shadow-sm"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5"
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Top 3 Podium — only rendered when rows are loaded and at least 1 exists */}
      {!loading && top3.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Reorder: 2nd | 1st | 3rd for visual podium effect */}
          {top3[1] && <PodiumCard row={top3[1]} place={2} />}
          {top3[0] && <PodiumCard row={top3[0]} place={1} />}
          {top3[2] && <PodiumCard row={top3[2]} place={3} />}
        </div>
      )}

      {/* Rest of rankings table */}
      <Card className="animate-fade-in overflow-hidden" style={{ animationDelay: "120ms" }}>
        <CardHeader className="border-b border-border bg-muted/30 py-4">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="h-5 w-5 rounded-md bg-primary/10 inline-flex items-center justify-center">
              <Trophy className="h-3 w-3 text-primary" />
            </span>
            Full Rankings &mdash; {PERIOD_LABELS[period]}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <DataTable
            data={tableData}
            loading={loading}
            columns={[
              {
                key: "rank",
                label: "Rank",
                sortable: true,
                render: (val) => <RankBadge rank={val as number} />,
              },
              {
                key: "repName",
                label: "Rep Name",
                sortable: true,
                render: (val, row) => {
                  const rank = (row as { rank: number }).rank;
                  return (
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                          rank === 1
                            ? "bg-amber-100 text-amber-700"
                            : rank === 2
                              ? "bg-slate-100 text-slate-700"
                              : rank === 3
                                ? "bg-orange-100 text-orange-700"
                                : "bg-muted text-muted-foreground"
                        )}
                      >
                        {getInitials(val as string)}
                      </div>
                      <span
                        className={cn(
                          "font-semibold",
                          rank === 1 && "text-amber-600",
                          rank === 2 && "text-slate-600",
                          rank === 3 && "text-orange-600"
                        )}
                      >
                        {val as string}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: "verifiedInstalls",
                label: "Verified Installs",
                sortable: true,
                render: (val, row) => {
                  const rank = (row as { rank: number }).rank;
                  return (
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        rank === 1 ? "text-amber-600" : "text-foreground"
                      )}
                    >
                      {val as number}
                    </span>
                  );
                },
              },
              {
                key: "sales",
                label: "Total Sales",
                sortable: true,
                render: (val) => (
                  <span className="font-medium tabular-nums text-foreground">{val as number}</span>
                ),
              },
              {
                key: "installRateDisplay",
                label: "Install Rate",
                sortable: false,
                render: (val) => (
                  <span className="font-medium text-muted-foreground">{val as string}</span>
                ),
              },
              {
                key: "tier",
                label: "Tier",
                render: (val) =>
                  val ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground">
                      <Star className="h-2.5 w-2.5 text-amber-500" />
                      {val as string}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  ),
              },
            ]}
            pagination
            pageSize={25}
            emptyMessage="No qualifying reps found for this period."
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: "200ms" }}>
        Only reps who are compliant (no active holds) and not governance-suspended
        (fewer than 2 consecutive strikes) appear on the leaderboard.
      </p>
    </div>
  );
}
